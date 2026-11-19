import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAndLoginUser, createE2eApp } from './e2e-helper';

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;

integration('Users (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let admin: { id: string; login: string; accessToken: string };
  let attendant: { id: string; login: string; accessToken: string };

  beforeAll(async () => {
    ({ app, db } = await createE2eApp(testUrl!));
    admin = await createAndLoginUser(app, db, 'ADMIN');
    attendant = await createAndLoginUser(app, db, 'ATTENDANT');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates, lists, views, updates and deactivates users with RBAC enforcement', async () => {
    const newLogin = `user_${randomUUID().slice(0, 8)}`;
    const newEmail = `${newLogin}@example.com`;

    // Non-admin cannot create users
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .auth(attendant.accessToken, { type: 'bearer' })
      .send({
        name: 'Blocked User',
        login: `${newLogin}_blocked`,
        password: 'StrongPassword123!',
      })
      .expect(403);

    // Admin creates user
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .auth(admin.accessToken, { type: 'bearer' })
      .send({
        name: 'Created User',
        login: newLogin,
        email: newEmail,
        password: 'StrongPassword123!',
        role: 'CASHIER',
      })
      .expect(201);
    const createdId = (created.body as { id: string }).id;

    // Duplicate login/email returns 409
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .auth(admin.accessToken, { type: 'bearer' })
      .send({
        name: 'Duplicate',
        login: newLogin,
        password: 'StrongPassword123!',
      })
      .expect(409);

    // Admin lists active users; attendant is forbidden
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .auth(attendant.accessToken, { type: 'bearer' })
      .expect(403);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/users')
      .auth(admin.accessToken, { type: 'bearer' })
      .expect(200);
    expect(listRes.body as { id: string }[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdId })]),
    );

    // Attendant can view own profile, cannot view another user
    await request(app.getHttpServer())
      .get(`/api/v1/users/${attendant.id}`)
      .auth(attendant.accessToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${createdId}`)
      .auth(attendant.accessToken, { type: 'bearer' })
      .expect(403);

    // Attendant can update own profile, cannot update another user
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${attendant.id}`)
      .auth(attendant.accessToken, { type: 'bearer' })
      .send({ name: 'Updated Self' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${createdId}`)
      .auth(attendant.accessToken, { type: 'bearer' })
      .send({ name: 'Forbidden Update' })
      .expect(403);

    // Admin deactivates created user; missing user returns 404
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${createdId}`)
      .auth(admin.accessToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${createdId}`)
      .auth(admin.accessToken, { type: 'bearer' })
      .expect(404);
  });
});
