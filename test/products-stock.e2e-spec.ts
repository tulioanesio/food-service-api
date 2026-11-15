import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAndLoginUser, createE2eApp } from './e2e-helper';

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;

integration('Products and Stock (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let managerToken: string;
  let stockManagerToken: string;
  let attendantToken: string;

  beforeAll(async () => {
    ({ app, db } = await createE2eApp(testUrl!));
    managerToken = (await createAndLoginUser(app, db, 'MANAGER')).accessToken;
    stockManagerToken = (await createAndLoginUser(app, db, 'STOCK_MANAGER'))
      .accessToken;
    attendantToken = (await createAndLoginUser(app, db, 'ATTENDANT'))
      .accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates, lists, updates and soft-deletes products with duplicate and RBAC checks', async () => {
    const productName = `Burger ${randomUUID()}`;

    // Attendant cannot create products
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .auth(attendantToken, { type: 'bearer' })
      .send({ name: productName, category: 'Burgers', price: 25.5 })
      .expect(403);

    // Manager creates product
    const created = await request(app.getHttpServer())
      .post('/api/v1/products')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: productName, category: 'Burgers', price: 25.5 })
      .expect(201);
    const productId = (created.body as { id: string }).id;

    // Duplicate name+category (case-insensitive) returns 409
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .auth(managerToken, { type: 'bearer' })
      .send({
        name: productName.toUpperCase(),
        category: 'burgers',
        price: 25.5,
      })
      .expect(409);

    // Search and get product
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/products')
      .auth(attendantToken, { type: 'bearer' })
      .query({ search: productName, category: 'Burgers' })
      .expect(200);
    expect(listRes.body as { id: string }[]).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .auth(attendantToken, { type: 'bearer' })
      .expect(200);

    // Update product price
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .auth(managerToken, { type: 'bearer' })
      .send({ price: 29.9 })
      .expect(200);

    // Soft-delete product and verify 404 afterwards
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}`)
      .auth(managerToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .auth(attendantToken, { type: 'bearer' })
      .expect(404);
  });

  it('manages stock movements idempotently, updates minimum quantity and filters lowStock', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: `Fries ${randomUUID()}`, category: 'Sides', price: 12 })
      .expect(201);
    const productId = (productRes.body as { id: string }).id;

    // Set minimum quantity to 10
    await request(app.getHttpServer())
      .patch(`/api/v1/stock/${productId}/minimum`)
      .auth(stockManagerToken, { type: 'bearer' })
      .send({ minimumQuantity: 10 })
      .expect(200);

    // Record idempotent ENTRY movement
    const entryKey = randomUUID();
    const firstMove = await request(app.getHttpServer())
      .post(`/api/v1/stock/${productId}/movements`)
      .auth(stockManagerToken, { type: 'bearer' })
      .send({
        type: 'ENTRY',
        quantity: 6,
        reason: 'Supplier delivery',
        idempotencyKey: entryKey,
      })
      .expect(201);

    const replayMove = await request(app.getHttpServer())
      .post(`/api/v1/stock/${productId}/movements`)
      .auth(stockManagerToken, { type: 'bearer' })
      .send({
        type: 'ENTRY',
        quantity: 6,
        reason: 'Supplier delivery',
        idempotencyKey: entryKey,
      })
      .expect(201);
    expect((replayMove.body as { id: string }).id).toBe(
      (firstMove.body as { id: string }).id,
    );

    // Reusing idempotencyKey with different quantity returns 409
    await request(app.getHttpServer())
      .post(`/api/v1/stock/${productId}/movements`)
      .auth(stockManagerToken, { type: 'bearer' })
      .send({
        type: 'ENTRY',
        quantity: 99,
        reason: 'Supplier delivery',
        idempotencyKey: entryKey,
      })
      .expect(409);

    // Check lowStock=true includes product (6 < 10)
    const lowStockList = await request(app.getHttpServer())
      .get('/api/v1/stock')
      .auth(attendantToken, { type: 'bearer' })
      .query({ lowStock: 'true' })
      .expect(200);
    expect(lowStockList.body as { productId: string }[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId })]),
    );

    // Get stock & movement history
    const stockRes = await request(app.getHttpServer())
      .get(`/api/v1/stock/${productId}`)
      .auth(attendantToken, { type: 'bearer' })
      .expect(200);
    expect(stockRes.body).toMatchObject({
      productId,
      totalQuantity: 6,
      minimumQuantity: 10,
      lowStock: true,
    });

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/stock/${productId}/movements`)
      .auth(stockManagerToken, { type: 'bearer' })
      .expect(200);
    expect(historyRes.body as { id: string }[]).toHaveLength(1);
  });
});
