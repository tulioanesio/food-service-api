import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { ReportsRepository } from '../repositories/reports.repository';
import {
  ProductsReportUseCase,
  SalesReportUseCase,
  StockReportUseCase,
} from './reports.use-cases';

describe('Reports use cases', () => {
  const repo = {
    sales: jest.fn(),
    products: jest.fn(),
    stock: jest.fn(),
  };
  const repository = repo as unknown as ReportsRepository;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('SalesReportUseCase', () => {
    const useCase = new SalesReportUseCase(repository);

    it('throws BadRequestException for invalid or inverted period bounds', async () => {
      await expect(
        useCase.execute({
          from: 'invalid-date',
          to: '2026-01-02T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          from: '2026-01-01T00:00:00Z',
          to: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          from: '2026-01-02T00:00:00Z',
          to: '2026-01-02T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calculates totals, average ticket with HALF_UP rounding, and receipts by method', async () => {
      repo.sales.mockResolvedValue([
        {
          _count: { _all: 3 },
          _sum: { total: new Prisma.Decimal('10.00') },
        },
        [
          {
            method: 'CASH',
            count: 2n,
            amount: new Prisma.Decimal('6.5'),
          },
          {
            method: 'PIX',
            count: 1n,
            amount: new Prisma.Decimal('3.5'),
          },
        ],
      ]);

      const result = await useCase.execute({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
      });

      expect(result).toEqual({
        period: {
          from: new Date('2026-01-01T00:00:00Z'),
          to: new Date('2026-01-02T00:00:00Z'),
        },
        orders: {
          count: 3,
          total: '10.00',
          averageTicket: '3.33',
        },
        receiptsByMethod: [
          { method: 'CASH', count: 2, amount: '6.50' },
          { method: 'PIX', count: 1, amount: '3.50' },
        ],
      });
    });

    it('returns zeroed totals and averageTicket when there are no completed orders', async () => {
      repo.sales.mockResolvedValue([
        {
          _count: { _all: 0 },
          _sum: { total: null },
        },
        [],
      ]);

      const result = await useCase.execute({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
      });

      expect(result.orders).toEqual({
        count: 0,
        total: '0.00',
        averageTicket: '0.00',
      });
      expect(result.receiptsByMethod).toEqual([]);
    });
  });

  describe('ProductsReportUseCase', () => {
    const useCase = new ProductsReportUseCase(repository);

    it('maps product rows and pagination metadata', async () => {
      repo.products.mockResolvedValue([
        [
          {
            productId: 'p1',
            name: 'Burger',
            category: 'Lanches',
            quantitySold: 5n,
            totalSold: new Prisma.Decimal('125.5'),
          },
        ],
        [{ total: 1n }],
      ]);

      const result = await useCase.execute({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        period: {
          from: new Date('2026-01-01T00:00:00Z'),
          to: new Date('2026-01-02T00:00:00Z'),
        },
        data: [
          {
            productId: 'p1',
            name: 'Burger',
            category: 'Lanches',
            quantitySold: 5,
            totalSold: '125.50',
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });

  describe('StockReportUseCase', () => {
    const useCase = new StockReportUseCase(repository);

    it('maps stock movement totals and computes netMovement', async () => {
      const asOf = new Date('2026-01-02T00:00:00Z');
      repo.stock.mockResolvedValue({
        asOf,
        total: 1,
        rows: [
          {
            productId: 'p1',
            name: 'Burger',
            isActive: true,
            currentQuantity: 12,
            minimumQuantity: 5,
            lowStock: false,
            entries: 20n,
            exits: 5n,
            losses: 2n,
            positiveAdjustments: 3n,
            negativeAdjustments: 4n,
          },
        ],
      });

      const result = await useCase.execute({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
        page: 1,
        limit: 10,
        lowStock: 'false',
      });

      expect(result).toEqual({
        period: {
          from: new Date('2026-01-01T00:00:00Z'),
          to: new Date('2026-01-02T00:00:00Z'),
        },
        asOf,
        data: [
          {
            productId: 'p1',
            name: 'Burger',
            isActive: true,
            currentQuantity: 12,
            minimumQuantity: 5,
            lowStock: false,
            entries: 20,
            exits: 5,
            losses: 2,
            positiveAdjustments: 3,
            negativeAdjustments: 4,
            netMovement: 12,
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });
});
