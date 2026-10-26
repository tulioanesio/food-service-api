import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ConfigService } from '@nestjs/config';
import { customPathDocs } from './swagger.paths';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const port = configService.get<number>('PORT') ?? 3000;

  const config = new DocumentBuilder()
    .setTitle('NestIgnite — Backend Template')
    .setDescription(
      'Fast-start NestJS template with Prisma, PostgreSQL and Docker.\n\n' +
        'This API exposes full **CRUD for users** as a baseline for your application.\n\n' +
        '**Stack:** NestJS · Prisma ORM · PostgreSQL · Docker\n\n' +
        '**Key features:** URI versioning (`/api/v1`), global validation pipe, ' +
        'Prisma exception filter, Helmet security headers, configurable CORS.\n\n' +
        '> Replace this description with your project-specific information before shipping to production.',
    )
    .setVersion('1.3.2')
    .setContact(
      'tulioanesio',
      'https://github.com/tulioanesio',
      'contact@yourdomain.com',
    )
    .setExternalDoc(
      'GitHub — NestIgnite',
      'https://github.com/tulioanesio/NestIgnite',
    )
    .addTag('Users', 'CRUD operations for user management.')
    .addTag('Health', 'Liveness probe with database connectivity check.')
    .addServer(`http://localhost:${port}`, 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  document.paths = {
    ...document.paths,
    ...customPathDocs,
  };

  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,

      User: {
        type: 'object',
        description: 'Persisted user entity returned by the API.',
        required: ['id', 'name', 'email'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '01965a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b',
            description: 'Unique identifier (UUIDv7).',
          },
          name: {
            type: 'string',
            example: 'John Doe',
            description: "User's full name.",
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
            description: 'Unique e-mail address.',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-15T10:30:00.000Z',
            description: 'Record creation timestamp (UTC).',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-06-01T08:00:00.000Z',
            description: 'Record last-update timestamp (UTC).',
          },
        },
      },

      CreateUserDto: {
        type: 'object',
        description: 'Payload required to register a new user.',
        required: ['name', 'email'],
        properties: {
          name: {
            type: 'string',
            example: 'John Doe',
            description: "User's full name. Must not be empty.",
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
            description: 'Valid and unique e-mail address.',
          },
        },
      },

      UpdateUserDto: {
        type: 'object',
        description:
          'Partial payload for updating an existing user. All fields are optional.',
        properties: {
          name: {
            type: 'string',
            example: 'Jane Doe',
            description: "User's updated full name.",
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'jane@example.com',
            description: 'Updated e-mail address.',
          },
        },
      },

      ErrorResponse: {
        type: 'object',
        description: 'Standard error shape returned by all error responses.',
        required: ['statusCode', 'message'],
        properties: {
          statusCode: {
            type: 'integer',
            example: 400,
            description: 'HTTP status code.',
          },
          message: {
            oneOf: [
              { type: 'string', example: 'Invalid input' },
              {
                type: 'array',
                items: { type: 'string' },
                example: ['name should not be empty', 'email must be an email'],
              },
            ],
            description: 'Human-readable error message or validation errors array.',
          },
          error: {
            type: 'string',
            example: 'Bad Request',
            description: 'HTTP error name.',
          },
        },
      },
    },
  };

  app.use(
    '/docs',
    apiReference({
      theme: 'kepler',
      content: document,
    } as any),
  );
}
