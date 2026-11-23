import type { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('sets Prometheus Content-Type header and returns metrics payload', async () => {
    const metricsService = {
      getContentType: jest
        .fn()
        .mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
      getMetrics: jest.fn().mockResolvedValue('http_requests_total 1\n'),
    };
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );

    await expect(controller.getMetrics(res)).resolves.toBe(
      'http_requests_total 1\n',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
  });
});
