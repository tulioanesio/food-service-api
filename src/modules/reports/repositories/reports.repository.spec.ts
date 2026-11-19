import { PrismaService } from 'src/prisma/prisma.service';
import { ReportsRepository } from './reports.repository';

describe('ReportsRepository', () => {
  const db = {
    order: { aggregate: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const repository = new ReportsRepository(db as unknown as PrismaService);
  const from = new Date('2026-01-01T00:00:00Z');
  const to = new Date('2026-01-02T00:00:00Z');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('queries sales aggregates and payment receipts in a RepeatableRead transaction', async () => {
    db.order.aggregate.mockReturnValue('aggOp');
    db.$queryRaw.mockReturnValue('paymentsOp');
    db.$transaction.mockResolvedValue(['aggResult', 'paymentsResult']);

    await expect(repository.sales(from, to)).resolves.toEqual([
      'aggResult',
      'paymentsResult',
    ]);
    expect(db.order.aggregate).toHaveBeenCalledWith({
      where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { total: true },
    });
    expect(db.$transaction).toHaveBeenCalledWith(['aggOp', 'paymentsOp'], {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('queries products report rows and total count in a RepeatableRead transaction', async () => {
    db.$queryRaw.mockReturnValueOnce('rowsOp').mockReturnValueOnce('countOp');
    db.$transaction.mockResolvedValue(['rowsResult', 'countResult']);

    await expect(repository.products(from, to, 2, 10)).resolves.toEqual([
      'rowsResult',
      'countResult',
    ]);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalledWith(['rowsOp', 'countOp'], {
      isolationLevel: 'RepeatableRead',
    });
  });

  it.each([undefined, 'true', 'false'] as const)(
    'queries stock report inside interactive RepeatableRead transaction when lowStock=%s',
    async (lowStock) => {
      const asOf = new Date('2026-01-02T00:00:00Z');
      const rows = [{ productId: 'p1' }];
      const tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([{ asOf }])
          .mockResolvedValueOnce([{ total: 4n }])
          .mockResolvedValueOnce(rows),
      };
      db.$transaction.mockImplementation(
        async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      );

      await expect(
        repository.stock(from, to, 1, 20, lowStock),
      ).resolves.toEqual({
        rows,
        total: 4,
        asOf,
      });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'RepeatableRead',
      });
    },
  );
});
