import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './e2e-helper';

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;

integration('Auth and Health (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;

  beforeAll(async () => {
    ({ app, db } = await createE2eApp(testUrl!));
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('exposes public health check endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('authenticates active users by login or email and rejects invalid or inactive credentials', async () => {
    const password = 'StrongPassword123!';
    const passwordHash = await bcrypt.hash(password, 4);
    const login = randomUUID();
    const email = `${login}@example.com`;

    const user = await db.user.create({
      data: {
        name: 'Auth E2E',
        login,
        email,
        passwordHash,
        role: 'ATTENDANT',
      },
    });

    // Login with username
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login, password })
      .expect(201);
    const token = (loginRes.body as { accessToken: string }).accessToken;
    expect(token).toBeTruthy();

    // Login with email
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login: email, password })
      .expect(201);

    // Wrong password
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login, password: 'wrong-password' })
      .expect(401);

    // Protected route without token
    await request(app.getHttpServer()).get('/api/v1/products').expect(401);

    // Protected route with valid token
    await request(app.getHttpServer())
      .get('/api/v1/products')
      .auth(token, { type: 'bearer' })
      .expect(200);

    // Deactivated user cannot login or use existing token
    await db.user.update({
      where: { id: user.id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login, password })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/products')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });
});
