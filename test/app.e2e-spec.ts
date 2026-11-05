import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from 'supertest/types';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '../src/common/filters/http-exception/http-exception.filter';
import { PrismaClientExceptionFilter } from '../src/common/filters/prisma-exception/prisma-exception.filter';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StripeGateway } from '../src/modules/payments/stripe.gateway';
import { Payment, UserRole } from '../src/generated/prisma/client';

// Run only against a dedicated database: migrations are applied by the caller.
const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;
integration(
  'Orders and payments (PostgreSQL + HTTP; Stripe network mocked)',
  () => {
    let app: INestApplication<App>;
    let db: PrismaService;
    let admin: string;
    let kitchen: string;
    let stockManager: string;
    const secret = 'whsec_orders_integration';
    const stripe = new Stripe('sk_test_local');
    const gateway = new StripeGateway(
      new ConfigService({
        STRIPE_SECRET_KEY: 'sk_test_local',
        STRIPE_WEBHOOK_SECRET: secret,
      }),
    );
    const createIntent = jest
      .spyOn(gateway, 'create')
      .mockImplementation((p: Payment) =>
        Promise.resolve({
          id: `pi_${p.id}`,
          object: 'payment_intent',
          amount: p.amount.mul(100).toNumber(),
          currency: 'brl',
          livemode: false,
          client_secret: 'test_secret',
          metadata: { paymentId: p.id, orderId: p.orderId },
          status: 'requires_payment_method',
        } as Stripe.Response<Stripe.PaymentIntent>),
      );
    beforeAll(async () => {
      process.env.DATABASE_URL = testUrl;
      process.env.JWT_SECRET = 'integration-only-secret-at-least-32-characters';
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(StripeGateway)
        .useValue(gateway)
        .compile();
      app = module.createNestApplication({ rawBody: true });
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      app.useGlobalFilters(
        new AllExceptionsFilter(),
        new PrismaClientExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
      );
      await app.init();
      db = app.get(PrismaService);
      const passwordHash = await bcrypt.hash('Test-password-123!', 4);
      async function login(role: UserRole) {
        const user = await db.user.create({
          data: {
            name: 'Integration',
            login: randomUUID(),
            passwordHash,
            role,
          },
        });
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ login: user.login, password: 'Test-password-123!' })
          .expect(201);
        return (response.body as { accessToken: string }).accessToken;
      }
      admin = await login('ADMIN');
      kitchen = await login('KITCHEN');
      stockManager = await login('STOCK_MANAGER');
    });
    afterAll(async () => {
      if (app) await app.close();
    });
    function post(path: string, body: object = {}, token = admin) {
      return request(app.getHttpServer())
        .post(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' })
        .send(body);
    }
    async function product(stock = 10, price = '12.50') {
      const response = await post('products', {
        name: randomUUID(),
        category: 'Test',
        price: Number(price),
      }).expect(201);
      const p = response.body as { id: string };
      const initial = await db.stock.findUniqueOrThrow({
        where: { productId: p.id },
      });
      expect(initial.totalQuantity).toBe(0);
      if (stock > 0)
        await post(
          `stock/${p.id}/movements`,
          {
            type: 'ENTRY',
            quantity: stock,
            reason: 'Initial inventory',
            idempotencyKey: randomUUID(),
          },
          stockManager,
        ).expect(201);
      return p;
    }

    async function order(productId: string, quantity = 1) {
      const response = await post('orders', {
        items: [{ productId, quantity }],
      }).expect(201);
      return (response.body as { id: string }).id;
    }
    async function cash(id: string, amount = '12.50', key = randomUUID()) {
      return post(`orders/${id}/payments`, {
        method: 'CASH',
        amount,
        receivedAmount: '20.00',
        idempotencyKey: key,
      });
    }
    it('protects routes and rejects invalid item quantities and arbitrary prices', async () => {
      await request(app.getHttpServer()).get('/api/v1/orders').expect(401);
      await post('orders', { items: [] }).expect(400);
      await post('orders', {
        items: [{ productId: randomUUID(), quantity: 0 }],
      }).expect(400);
      await post('orders', {
        items: [{ productId: randomUUID(), quantity: 1, unitPrice: 1 }],
      }).expect(400);
      await post(
        'orders',
        { items: [{ productId: randomUUID(), quantity: 1 }] },
        kitchen,
      ).expect(403);
    });
    it('consolidates repeated items, preserves prices and completes only when fully paid', async () => {
      const p = await product();
      const response = await post('orders', {
        items: [
          { productId: p.id, quantity: 1 },
          { productId: p.id, quantity: 1 },
        ],
      }).expect(201);
      const id = (response.body as { id: string }).id;
      expect(response.body).toMatchObject({
        total: '25',
        items: [{ quantity: 2, unitPrice: '12.5' }],
      });
      await db.product.update({ where: { id: p.id }, data: { price: '99' } });
      await post(`orders/${id}/confirm`).expect(201);
      await post(`orders/${id}/confirm`).expect(201);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: p.id } }))
          .totalQuantity,
      ).toBe(8);
      await cash(id).then((r) => expect(r.status).toBe(201));
      await post(`orders/${id}/prepare`, {}, kitchen).expect(201);
      await post(`orders/${id}/ready`, {}, kitchen).expect(201);
      await post(`orders/${id}/complete`).expect(409);
      await cash(id).then((r) => expect(r.status).toBe(201));
      await post(`orders/${id}/complete`).expect(201);
      await post(`orders/${id}/cancel`, { reason: 'too late' }).expect(409);
    });
    it('serializes competing confirmations and rolls back partial stock debits', async () => {
      const p = await product(1);
      const ids = await Promise.all([order(p.id), order(p.id)]);
      const results = await Promise.all(
        ids.map((id) => post(`orders/${id}/confirm`)),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: p.id } }))
          .totalQuantity,
      ).toBe(0);
      const a = await product(3);
      const b = await product(0);
      const response = await post('orders', {
        items: [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 1 },
        ],
      });
      const id = (response.body as { id: string }).id;
      await post(`orders/${id}/confirm`).expect(409);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: a.id } }))
          .totalQuantity,
      ).toBe(3);
      expect(await db.stockMovement.count({ where: { orderId: id } })).toBe(0);
      expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe(
        'OPEN',
      );
    });
    it('prevents overpayment races, replays idempotently and records cash change', async () => {
      const p = await product();
      const id = await order(p.id);
      await post(`orders/${id}/confirm`).expect(201);
      const keys = [randomUUID(), randomUUID()];
      const results = await Promise.all(
        keys.map((key) => cash(id, '12.50', key)),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const index = results.findIndex((r) => r.status === 201);
      expect(results[index].body).toMatchObject({
        payment: { amount: '12.5', change: '7.5', receivedAmount: '20' },
      });
      await cash(id, '12.50', keys[index]).then((r) =>
        expect(r.status).toBe(201),
      );
      await cash(id, '1.00', keys[index]).then((r) =>
        expect(r.status).toBe(409),
      );
      expect(await db.payment.count({ where: { orderId: id } })).toBe(1);
      await post(`orders/${id}/cancel`, { reason: 'refund first' }).expect(409);
      const payment = await db.payment.findFirstOrThrow({
        where: { orderId: id },
      });
      await post(`payments/${payment.id}/reverse`, {
        reason: 'customer cancellation',
      }).expect(201);
      await post(`orders/${id}/cancel`, {
        reason: 'customer cancellation',
      }).expect(201);
      await post(`orders/${id}/cancel`, {
        reason: 'customer cancellation',
      }).expect(201);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: p.id } }))
          .totalQuantity,
      ).toBe(10);
    });
    it('accepts signed Stripe events, rejects tampering, ignores duplicates and keeps declined intents reserved', async () => {
      const p = await product();
      const id = await order(p.id);
      await post(`orders/${id}/confirm`).expect(201);
      const key = randomUUID();
      const response = await post(`orders/${id}/payments`, {
        method: 'CREDIT_CARD',
        amount: '12.50',
        idempotencyKey: key,
      }).expect(201);
      const payment = (response.body as { payment: Payment }).payment;
      expect(payment.status).toBe('PENDING');
      expect(createIntent).toHaveBeenCalled();
      const intent = {
        id: payment.transactionId,
        object: 'payment_intent',
        metadata: { paymentId: payment.id, orderId: id },
        amount: 1250,
        currency: 'brl',
        livemode: false,
      };
      async function event(type: string, changes = {}) {
        const body = JSON.stringify({
          id: randomUUID(),
          object: 'event',
          type,
          livemode: false,
          data: { object: { ...intent, ...changes } },
        });
        const header = stripe.webhooks.generateTestHeaderString({
          payload: body,
          secret,
        });
        return request(app.getHttpServer())
          .post('/api/v1/payments/stripe/webhook')
          .set('Content-Type', 'application/json')
          .set('stripe-signature', header)
          .send(body);
      }
      await request(app.getHttpServer())
        .post('/api/v1/payments/stripe/webhook')
        .send({})
        .expect(400);
      expect((await event('payment_intent.payment_failed')).status).toBe(200);
      await cash(id).then((r) => expect(r.status).toBe(409));
      expect(
        (await event('payment_intent.succeeded', { amount: 1 })).status,
      ).toBe(400);
      expect((await event('payment_intent.succeeded')).status).toBe(200);
      expect((await event('payment_intent.succeeded')).status).toBe(200);
      expect((await event('payment_intent.payment_failed')).status).toBe(200);
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .status,
      ).toBe('PAID');
    });
    it('keeps a timed-out creation reserved and recovers using the same payment ID', async () => {
      const p = await product();
      const id = await order(p.id);
      await post(`orders/${id}/confirm`).expect(201);
      const dto = {
        method: 'CREDIT_CARD',
        amount: '12.50',
        idempotencyKey: randomUUID(),
      };
      createIntent.mockRejectedValueOnce(new Error('timeout'));
      await post(`orders/${id}/payments`, dto).expect(503);
      const reserved = await db.payment.findFirstOrThrow({
        where: { orderId: id },
      });
      expect(reserved.status).toBe('PENDING');
      await cash(id).then((r) => expect(r.status).toBe(409));
      const result = await post(`orders/${id}/payments`, dto).expect(201);
      expect(result.body).toMatchObject({
        payment: { id: reserved.id, transactionId: `pi_${reserved.id}` },
      });
      expect(await db.payment.count({ where: { orderId: id } })).toBe(1);
    });
    it('persists a pending refund, blocks preparation and reconciles without another refund', async () => {
      const p = await product();
      const id = await order(p.id);
      await post(`orders/${id}/confirm`).expect(201);
      const response = await post(`orders/${id}/payments`, {
        method: 'CREDIT_CARD',
        amount: '12.50',
        idempotencyKey: randomUUID(),
      }).expect(201);
      const payment = (response.body as { payment: Payment }).payment;
      const intent = {
        id: payment.transactionId,
        status: 'succeeded',
        metadata: { paymentId: payment.id, orderId: id },
        amount: 1250,
        currency: 'brl',
        livemode: false,
      } as Stripe.Response<Stripe.PaymentIntent>;
      const retrieve = jest
        .spyOn(gateway, 'retrieve')
        .mockResolvedValue(intent);
      const refund = jest.spyOn(gateway, 'refund').mockResolvedValue({
        id: `re_${payment.id}`,
        status: 'pending',
      } as Stripe.Response<Stripe.Refund>);
      const getRefund = jest.spyOn(gateway, 'getRefund').mockResolvedValue({
        id: `re_${payment.id}`,
        status: 'succeeded',
      } as Stripe.Response<Stripe.Refund>);
      await post(`payments/${payment.id}/reverse`, {
        reason: 'cancel sale',
      }).expect(409);
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .status,
      ).toBe('REFUND_PENDING');
      await post(`orders/${id}/prepare`, {}, kitchen).expect(409);
      await post(`orders/${id}/cancel`, { reason: 'cancel sale' }).expect(409);
      await post(`payments/${payment.id}/reverse`, {
        reason: 'cancel sale',
      }).expect(201);
      expect(refund).toHaveBeenCalledTimes(1);
      expect(getRefund).toHaveBeenCalledTimes(1);
      await post(`payments/${payment.id}/reverse`, {
        reason: 'cancel sale',
      }).expect(201);
      expect(getRefund).toHaveBeenCalledTimes(1);
      await post(`orders/${id}/cancel`, { reason: 'cancel sale' }).expect(201);
      retrieve.mockRestore();
      refund.mockRestore();
      getRefund.mockRestore();
    });

    it('tracks losses, signed adjustments, minimum stock and history with permissions', async () => {
      const p = await product(5);
      const movement = {
        type: 'LOSS',
        quantity: 2,
        reason: 'Expired',
        idempotencyKey: randomUUID(),
      };
      await post(`stock/${p.id}/movements`, movement, kitchen).expect(403);
      await post(
        `stock/${p.id}/movements`,
        { ...movement, quantity: -1 },
        stockManager,
      ).expect(400);
      await post(
        `stock/${p.id}/movements`,
        { ...movement, quantity: 0 },
        stockManager,
      ).expect(400);
      await post(`stock/${p.id}/movements`, movement, stockManager).expect(201);
      await post(`stock/${p.id}/movements`, movement, stockManager).expect(201);
      await post(
        `stock/${p.id}/movements`,
        { ...movement, quantity: 1 },
        stockManager,
      ).expect(409);
      await post(
        `stock/${p.id}/movements`,
        {
          ...movement,
          type: 'ADJUSTMENT',
          quantity: -1,
          idempotencyKey: randomUUID(),
        },
        stockManager,
      ).expect(201);
      await post(
        `stock/${p.id}/movements`,
        {
          ...movement,
          type: 'ADJUSTMENT',
          quantity: 2,
          idempotencyKey: randomUUID(),
        },
        stockManager,
      ).expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/stock/${p.id}/minimum`)
        .auth(stockManager, { type: 'bearer' })
        .send({ minimumQuantity: 5 })
        .expect(200);
      const stock = await request(app.getHttpServer())
        .get(`/api/v1/stock/${p.id}`)
        .auth(kitchen, { type: 'bearer' })
        .expect(200);
      expect(stock.body).toMatchObject({
        totalQuantity: 4,
        inputQuantity: 7,
        outputQuantity: 3,
        minimumQuantity: 5,
        lowStock: true,
      });
      const low = await request(app.getHttpServer())
        .get('/api/v1/stock?lowStock=true')
        .auth(stockManager, { type: 'bearer' })
        .expect(200);
      expect(low.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ productId: p.id })]),
      );
      const history = await request(app.getHttpServer())
        .get(`/api/v1/stock/${p.id}/movements?type=LOSS`)
        .auth(stockManager, { type: 'bearer' })
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(history.body).toEqual([
        expect.objectContaining({
          quantity: 2,
          reason: 'Expired',
          userId: expect.any(String) as unknown,
        }),
      ]);
    });
    it('serializes concurrent stock exits against order confirmation', async () => {
      const p = await product(1);
      const id = await order(p.id);
      const results = await Promise.all([
        post(`orders/${id}/confirm`),
        post(
          `stock/${p.id}/movements`,
          {
            type: 'EXIT',
            quantity: 1,
            reason: 'Counter sale',
            idempotencyKey: randomUUID(),
          },
          stockManager,
        ),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: p.id } }))
          .totalQuantity,
      ).toBe(0);
      expect(
        await db.stockMovement.count({
          where: { productId: p.id, type: 'EXIT' },
        }),
      ).toBe(1);
    });
    it('serializes duplicate stock entries without duplicate inventory', async () => {
      const p = await product(0);
      const dto = {
        type: 'ENTRY',
        quantity: 4,
        reason: 'Delivery',
        idempotencyKey: randomUUID(),
      };
      const results = await Promise.all([
        post(`stock/${p.id}/movements`, dto, stockManager),
        post(`stock/${p.id}/movements`, dto, stockManager),
      ]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(
        (await db.stock.findUniqueOrThrow({ where: { productId: p.id } }))
          .totalQuantity,
      ).toBe(4);
      expect(await db.stockMovement.count({ where: { productId: p.id } })).toBe(
        1,
      );
    });
  },
);
