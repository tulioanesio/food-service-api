import type { NextFunction, Response } from 'express';
import {
  CorrelationIdMiddleware,
  RequestWithId,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('generates a UUID when X-Request-Id header is absent or blank', () => {
    const req = {
      headers: { 'x-request-id': '   ' },
    } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserves incoming X-Request-Id header when provided', () => {
    const req = {
      headers: { 'x-request-id': '  req-trace-123  ' },
    } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBe('req-trace-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-trace-123');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
