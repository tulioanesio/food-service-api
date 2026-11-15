import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAndLoginUser, createE2eApp } from './e2e-helper';

function generateValidCpf(): string {
  const digits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 9),
  );
  if (digits.every((d) => d === digits[0])) digits[0] = (digits[0] + 1) % 9;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += digits[i] * (size + 1 - i);
    const mod = (sum * 10) % 11;
    digits.push(mod === 10 ? 0 : mod);
  }
  return digits.join('');
}

const testUrl = process.env.TEST_DATABASE_URL;
const integration = testUrl ? describe : describe.skip;

integration('Customers (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let attendantToken: string;
  let kitchenToken: string;

  beforeAll(async () => {
    ({ app, db } = await createE2eApp(testUrl!));
    attendantToken = (await createAndLoginUser(app, db, 'ATTENDANT'))
      .accessToken;
    kitchenToken = (await createAndLoginUser(app, db, 'KITCHEN')).accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates, lists, fetches, updates and clears nullable fields for customers', async () => {
    const cpf = generateValidCpf();
    const uniqueName = `Maria ${randomUUID()}`;

    // Forbidden for KITCHEN role
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .auth(kitchenToken, { type: 'bearer' })
      .send({ name: uniqueName })
      .expect(403);

    // Create customer with formatted CPF and +55 phone
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .auth(attendantToken, { type: 'bearer' })
      .send({
        name: uniqueName,
        cpf,
        phone: '+55 (11) 99999-8888',
      })
      .expect(201);

    const customer = created.body as {
      id: string;
      name: string;
      cpf: string | null;
      phone: string | null;
    };
    expect(customer.cpf).toBe(cpf);
    expect(customer.phone).toBe('11999998888');

    // Duplicate CPF returns 409 Conflict
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .auth(attendantToken, { type: 'bearer' })
      .send({ name: 'Outro Nome', cpf })
      .expect(409);

    // Search by normalized CPF
    const listed = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .auth(attendantToken, { type: 'bearer' })
      .query({ search: cpf, page: 1, limit: 10 })
      .expect(200);

    expect((listed.body as { data: { id: string }[] }).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: customer.id })]),
    );

    // Get by ID
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${customer.id}`)
      .auth(attendantToken, { type: 'bearer' })
      .expect(200);

    // Get missing ID returns 404
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${randomUUID()}`)
      .auth(attendantToken, { type: 'bearer' })
      .expect(404);

    // Update name and clear CPF/phone with null
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.id}`)
      .auth(attendantToken, { type: 'bearer' })
      .send({ name: `${uniqueName} Atualizada`, cpf: null, phone: null })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: customer.id,
      name: `${uniqueName} Atualizada`,
      cpf: null,
      phone: null,
    });
  });

  it('rejects invalid CPF and invalid UUID parameters', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .auth(attendantToken, { type: 'bearer' })
      .send({ name: 'Inválido', cpf: '11111111111' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/customers/not-a-uuid')
      .auth(attendantToken, { type: 'bearer' })
      .expect(400);
  });
});
