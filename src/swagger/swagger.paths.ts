// ─────────────────────────────────────────────────────────────────────────────
// swagger.paths.ts
//
// Manual OpenAPI path definitions for routes that live outside the auto-
// generated Swagger decorators. These objects are merged into the final
// OpenAPI document produced in swagger.ts.
//
// Routes are aligned with the NestJS controller prefixes:
//   Global prefix : /api
//   URI version   : /v1   (defaultVersion = '1')
//   Controller    : @Controller('user')
//
// ➜ effective base path: /api/v1/user
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shared helpers ───────────────────────────────────────────────────────────

const uuid = '01965a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b';

const userExample = {
  id: uuid,
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: '2025-01-15T10:30:00.000Z',
  updatedAt: '2025-01-15T10:30:00.000Z',
};

/** Minimal pagination metadata object. */
const paginationMeta = (total: number, pages: number) => ({
  totalItems: total,
  totalPages: pages,
  currentPage: 1,
  itemsPerPage: 10,
  hasNextPage: pages > 1,
  hasPreviousPage: false,
});

/** OpenAPI path parameter helper. */
const pathParam = (name: string, desc: string) => ({
  name,
  in: 'path' as const,
  required: true,
  description: desc,
  schema: { type: 'string', format: 'uuid' },
  example: uuid,
});

/** Pagination query parameters shared across list endpoints. */
const pageParams = [
  {
    name: 'page',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer', default: 1, minimum: 1 },
    description: 'Page number (1-based).',
  },
  {
    name: 'limit',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
    description: 'Number of items per page.',
  },
];

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = (code: number, description: string, message?: string | string[]) => ({
  description,
  content: {
    'application/json': {
      schema: ref('ErrorResponse'),
      example: {
        statusCode: code,
        message: message ?? description,
        error: httpErrorName(code),
      },
    },
  },
});

function httpErrorName(code: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  return map[code] ?? 'Error';
}

export const customPathDocs = {

  '/api/v1/user': {

    get: {
      tags: ['Users'],
      summary: 'List all users',
      description:
        'Returns a paginated list of all registered users. ' +
        'Use `page` and `limit` query parameters to control the result window.',
      parameters: pageParams,
      responses: {
        '200': {
          description: 'Paginated list of users retrieved successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: ref('User'),
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      totalItems: { type: 'integer', example: 45 },
                      totalPages: { type: 'integer', example: 5 },
                      currentPage: { type: 'integer', example: 1 },
                      itemsPerPage: { type: 'integer', example: 10 },
                      hasNextPage: { type: 'boolean', example: true },
                      hasPreviousPage: { type: 'boolean', example: false },
                    },
                  },
                },
              },
              example: {
                data: [userExample],
                meta: paginationMeta(45, 5),
              },
            },
          },
        },
      },
    },

    post: {
      tags: ['Users'],
      summary: 'Create a new user',
      description:
        'Registers a new user in the system. ' +
        'The `email` field must be unique — attempting to register a duplicate ' +
        'e-mail returns `409 Conflict`.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('CreateUserDto'),
            example: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'User created successfully. Returns the persisted entity.',
          content: {
            'application/json': {
              schema: ref('User'),
              example: userExample,
            },
          },
        },
        '400': errorResponse(
          400,
          'Validation failed.',
          ['name should not be empty', 'email must be an email'],
        ),
        '409': errorResponse(409, 'E-mail address is already in use.'),
      },
    },
  },

  '/api/v1/user/{id}': {

    get: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Retrieves a single user by their unique UUID.',
      parameters: [pathParam('id', 'UUID of the user to retrieve.')],
      responses: {
        '200': {
          description: 'User found and returned.',
          content: {
            'application/json': {
              schema: ref('User'),
              example: userExample,
            },
          },
        },
        '404': errorResponse(404, 'User not found.'),
      },
    },

    patch: {
      tags: ['Users'],
      summary: 'Update a user',
      description:
        'Partially updates an existing user (`PartialType` — all fields optional). ' +
        'Only provided fields are updated; omitted fields remain unchanged.',
      parameters: [pathParam('id', 'UUID of the user to update.')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('UpdateUserDto'),
            example: {
              name: 'Jane Doe',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'User updated successfully. Returns the updated entity.',
          content: {
            'application/json': {
              schema: ref('User'),
              example: {
                ...userExample,
                name: 'Jane Doe',
                updatedAt: '2025-06-01T08:00:00.000Z',
              },
            },
          },
        },
        '400': errorResponse(
          400,
          'Validation failed.',
          ['email must be an email'],
        ),
        '404': errorResponse(404, 'User not found.'),
        '409': errorResponse(409, 'E-mail address is already in use.'),
      },
    },

    delete: {
      tags: ['Users'],
      summary: 'Delete a user',
      description:
        'Permanently removes a user from the system. ' +
        'Returns the deleted entity so the caller can confirm what was removed.',
      parameters: [pathParam('id', 'UUID of the user to delete.')],
      responses: {
        '200': {
          description: 'User deleted successfully. Returns the removed entity.',
          content: {
            'application/json': {
              schema: ref('User'),
              example: userExample,
            },
          },
        },
        '404': errorResponse(404, 'User not found.'),
      },
    },
  },

  '/api/v1/health': {

    get: {
      tags: ['Health'],
      summary: 'Health check',
      description:
        'Liveness probe that verifies API availability and PostgreSQL ' +
        'reachability via a Prisma ping query.',
      responses: {
        '200': {
          description: 'Service is healthy.',
          content: {
            'application/json': {
              example: {
                status: 'ok',
                info: { database: { status: 'up' } },
                error: {},
                details: { database: { status: 'up' } },
              },
            },
          },
        },
        '503': {
          description: 'Service is unhealthy — database is unreachable.',
          content: {
            'application/json': {
              example: {
                status: 'error',
                info: {},
                error: {
                  database: { status: 'down', message: 'Connection timeout' },
                },
                details: {
                  database: { status: 'down', message: 'Connection timeout' },
                },
              },
            },
          },
        },
      },
    },
  },
};
