import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { RequestWithId } from './correlation-id.middleware';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();

    const startedAt = process.hrtime.bigint();
    const method = req.method;
    const routeObj = req.route as { path?: unknown } | undefined;
    const route = typeof routeObj?.path === 'string' ? routeObj.path : req.path;
    const requestId = req.requestId ?? '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number(
            (Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(
              2,
            ),
          );
          const statusCode = res.statusCode;
          this.metricsService.recordHttpRequest(
            method,
            route,
            statusCode,
            durationMs,
          );
          this.logger.log(
            JSON.stringify({
              level: 'info',
              requestId,
              method,
              route,
              statusCode,
              durationMs,
            }),
          );
        },
        error: (error: unknown) => {
          const durationMs = Number(
            (Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(
              2,
            ),
          );
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          this.metricsService.recordHttpRequest(
            method,
            route,
            statusCode,
            durationMs,
          );
          this.logger.error(
            JSON.stringify({
              level: 'error',
              requestId,
              method,
              route,
              statusCode,
              durationMs,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        },
      }),
    );
  }
}
