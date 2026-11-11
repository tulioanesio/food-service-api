// ConfigModule.forRoot runs during module import, before Jest beforeAll hooks.
if (process.env.TEST_DATABASE_URL) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must point to a dedicated database ending in _test',
    );
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'integration-only-secret-at-least-32-characters';
  process.env.NODE_ENV = 'test';
}
