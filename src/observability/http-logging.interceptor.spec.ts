import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { MetricsService } from './metrics.service';

describe('HttpLoggingInterceptor', () => {
  const metricsService = {
    recordHttpRequest: jest.fn(),
  };
  const interceptor = new HttpLoggingInterceptor(
    metricsService as unknown as MetricsService,
  );

  const makeContext = (
    reqOverrides: Record<string, unknown> = {},
    statusCode = 200,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/api/v1/health',
          requestId: 'req-1',
          ...reqOverrides,
        }),
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records metrics and logs structured info on successful response', async () => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const ctx = makeContext({ route: { path: '/api/v1/health' } }, 200);

    await expect(
      lastValueFrom(interceptor.intercept(ctx, handler)),
    ).resolves.toEqual({ ok: true });

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/health',
      200,
      expect.any(Number),
    );
  });

  it('records HttpException status code and logs error', async () => {
    const handler: CallHandler = {
      handle: () => throwError(() => new BadRequestException('Invalid input')),
    };
    const ctx = makeContext({ requestId: undefined });

    await expect(
      lastValueFrom(interceptor.intercept(ctx, handler)),
    ).rejects.toThrow(BadRequestException);

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/health',
      400,
      expect.any(Number),
    );
  });

  it('records status 500 for non-HttpException errors', async () => {
    const handler: CallHandler = {
      handle: () => throwError(() => 'unexpected string failure'),
    };
    const ctx = makeContext();

    await expect(
      lastValueFrom(interceptor.intercept(ctx, handler)),
    ).rejects.toBe('unexpected string failure');

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/health',
      500,
      expect.any(Number),
    );
  });
});
