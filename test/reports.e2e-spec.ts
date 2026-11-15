import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAndLoginUser, createE2eApp } from './e2e-helper';

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;

integration('Reports (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let managerToken: string;
  let attendantToken: string;

  beforeAll(async () => {
    ({ app, db } = await createE2eApp(testUrl!));
    managerToken = (await createAndLoginUser(app, db, 'MANAGER')).accessToken;
    attendantToken = (await createAndLoginUser(app, db, 'ATTENDANT'))
      .accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('enforces RBAC and period validation on reports endpoints', async () => {
    const from = '2026-01-01T00:00:00Z';
    const to = '2026-12-31T23:59:59Z';

    await request(app.getHttpServer())
      .get('/api/v1/reports/sales')
      .auth(attendantToken, { type: 'bearer' })
      .query({ from, to })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/reports/sales')
      .auth(managerToken, { type: 'bearer' })
      .query({ from: to, to: from })
      .expect(400);
  });

  it('returns sales, products and stock reports with accurate aggregations', async () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const product = await request(app.getHttpServer())
      .post('/api/v1/products')
      .auth(managerToken, { type: 'bearer' })
      .send({
        name: `Report Item ${randomUUID()}`,
        category: 'Food',
        price: 20,
      })
      .expect(201);
    const productId = (product.body as { id: string }).id;

    // Seed stock (ADMIN/MANAGER/STOCK_MANAGER allowed)
    await request(app.getHttpServer())
      .post(`/api/v1/stock/${productId}/movements`)
      .auth(managerToken, { type: 'bearer' })
      .send({
        type: 'ENTRY',
        quantity: 10,
        reason: 'Initial stock',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    // Create, confirm, pay, prepare, ready and complete order
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .auth(managerToken, { type: 'bearer' })
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(201);
    const orderId = (orderRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/confirm`)
      .auth(managerToken, { type: 'bearer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .auth(managerToken, { type: 'bearer' })
      .send({
        method: 'PIX',
        amount: '40.00',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/prepare`)
      .auth(managerToken, { type: 'bearer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/ready`)
      .auth(managerToken, { type: 'bearer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/complete`)
      .auth(managerToken, { type: 'bearer' })
      .expect(201);

    const end = new Date(Date.now() + 60_000).toISOString();

    const salesRes = await request(app.getHttpServer())
      .get('/api/v1/reports/sales')
      .auth(managerToken, { type: 'bearer' })
      .query({ from: start, to: end })
      .expect(200);
    expect(
      (salesRes.body as { orders: { count: number } }).orders.count,
    ).toBeGreaterThanOrEqual(1);

    const productsRes = await request(app.getHttpServer())
      .get('/api/v1/reports/products')
      .auth(managerToken, { type: 'bearer' })
      .query({ from: start, to: end, page: 1, limit: 20 })
      .expect(200);
    expect(
      (productsRes.body as { data: { productId: string }[] }).data,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ productId })]));

    const stockRes = await request(app.getHttpServer())
      .get('/api/v1/reports/stock')
      .auth(managerToken, { type: 'bearer' })
      .query({ from: start, to: end, page: 1, limit: 50, lowStock: 'false' })
      .expect(200);
    expect(
      (stockRes.body as { data: { productId: string; netMovement: number }[] })
        .data,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId, netMovement: 8 }),
      ]),
    );
  });
});
