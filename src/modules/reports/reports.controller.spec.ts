import { ReportsController } from './reports.controller';
import {
  ProductsReportUseCase,
  SalesReportUseCase,
  StockReportUseCase,
} from './use-cases/reports.use-cases';

describe('ReportsController', () => {
  const salesReport = { execute: jest.fn() };
  const productsReport = { execute: jest.fn() };
  const stockReport = { execute: jest.fn() };

  const controller = new ReportsController(
    salesReport as unknown as SalesReportUseCase,
    productsReport as unknown as ProductsReportUseCase,
    stockReport as unknown as StockReportUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates sales to SalesReportUseCase', async () => {
    const query = {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T00:00:00Z',
    };
    salesReport.execute.mockResolvedValue({ orders: { count: 0 } });

    await expect(controller.sales(query)).resolves.toEqual({
      orders: { count: 0 },
    });
    expect(salesReport.execute).toHaveBeenCalledWith(query);
  });

  it('delegates products to ProductsReportUseCase', async () => {
    const query = {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T00:00:00Z',
      page: 1,
      limit: 20,
    };
    productsReport.execute.mockResolvedValue({ data: [] });

    await expect(controller.products(query)).resolves.toEqual({ data: [] });
    expect(productsReport.execute).toHaveBeenCalledWith(query);
  });

  it('delegates stock to StockReportUseCase', async () => {
    const query = {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T00:00:00Z',
      page: 1,
      limit: 20,
    };
    stockReport.execute.mockResolvedValue({ data: [] });

    await expect(controller.stock(query)).resolves.toEqual({ data: [] });
    expect(stockReport.execute).toHaveBeenCalledWith(query);
  });
});
