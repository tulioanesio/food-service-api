import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service';

const connectMock = jest.fn();
const disconnectMock = jest.fn();

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((config: unknown) => ({ config })),
}));

jest.mock('src/generated/prisma/client', () => ({
  PrismaClient: class {
    $connect = connectMock;
    $disconnect = disconnectMock;
  },
}));

describe('PrismaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes PrismaPg adapter from DATABASE_URL and connects/disconnects on lifecycle hooks', async () => {
    const configService = {
      get: jest
        .fn()
        .mockReturnValue('postgresql://user:pass@localhost:5432/db'),
    };
    const service = new PrismaService(
      configService as unknown as ConfigService,
    );

    expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:5432/db',
    });

    await service.onModuleInit();
    expect(connectMock).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
