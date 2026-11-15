import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('executes database ping check via HealthCheckService', async () => {
    const db = {
      pingCheck: jest.fn().mockResolvedValue({ db: { status: 'up' } }),
    };
    const prismaService = {} as PrismaService;
    const health = {
      check: jest
        .fn()
        .mockImplementation(async (indicators: (() => Promise<unknown>)[]) =>
          Promise.all(indicators.map((fn) => fn())),
        ),
    };
    const controller = new HealthController(
      health as unknown as HealthCheckService,
      db as unknown as PrismaHealthIndicator,
      prismaService,
    );

    const result = await controller.check();

    expect(health.check).toHaveBeenCalledTimes(1);
    expect(db.pingCheck).toHaveBeenCalledWith('database', prismaService);
    expect(result).toEqual([{ db: { status: 'up' } }]);
  });
});
