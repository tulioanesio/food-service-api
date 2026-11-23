import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('records HTTP request counters/histograms and exposes Prometheus metrics', async () => {
    const service = new MetricsService();

    service.recordHttpRequest('GET', '/api/v1/health', 200, 12.5);
    service.recordHttpRequest('POST', '/api/v1/orders', 201, 45.2);

    const output = await service.getMetrics();
    expect(service.getContentType()).toContain('text/plain');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('route="/api/v1/health"');
    expect(output).toContain('status_code="201"');
  });
});
