import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception/http-exception.filter';
import { PrismaClientExceptionFilter } from '../src/common/filters/prisma-exception/prisma-exception.filter';
import { UserRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createE2eApp(testUrl: string): Promise<{
  app: INestApplication<App>;
  db: PrismaService;
}> {
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = 'integration-only-secret-at-least-32-characters';

  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication<INestApplication<App>>({
    rawBody: true,
  });
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

  return { app, db: app.get(PrismaService) };
}

export async function createAndLoginUser(
  app: INestApplication<App>,
  db: PrismaService,
  role: UserRole,
): Promise<{ id: string; login: string; accessToken: string }> {
  const password = 'Test-password-123!';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await db.user.create({
    data: {
      name: `E2E ${role}`,
      login: randomUUID(),
      passwordHash,
      role,
    },
  });

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ login: user.login, password })
    .expect(201);

  return {
    id: user.id,
    login: user.login,
    accessToken: (response.body as { accessToken: string }).accessToken,
  };
}
