import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StockController } from './stock.controller';
import {
  GetStockUseCase,
  ListStockUseCase,
  MoveStockUseCase,
  StockHistoryUseCase,
  UpdateStockMinimumUseCase,
} from './use-cases/stock.use-cases';

describe('StockController', () => {
  const getStock = { execute: jest.fn() };
  const listStock = { execute: jest.fn() };
  const moveStock = { execute: jest.fn() };
  const history = { execute: jest.fn() };
  const minimum = { execute: jest.fn() };

  const controller = new StockController(
    getStock as unknown as GetStockUseCase,
    listStock as unknown as ListStockUseCase,
    moveStock as unknown as MoveStockUseCase,
    history as unknown as StockHistoryUseCase,
    minimum as unknown as UpdateStockMinimumUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates list to ListStockUseCase with boolean lowStock flag', async () => {
    listStock.execute.mockResolvedValue([{ productId: 'p1' }]);

    await expect(controller.list({ lowStock: 'true' })).resolves.toEqual([
      { productId: 'p1' },
    ]);
    expect(listStock.execute).toHaveBeenCalledWith(true);

    await controller.list({});
    expect(listStock.execute).toHaveBeenLastCalledWith(false);
  });

  it('delegates get to GetStockUseCase', async () => {
    getStock.execute.mockResolvedValue({ productId: 'p1', lowStock: false });

    await expect(controller.get('p1')).resolves.toEqual({
      productId: 'p1',
      lowStock: false,
    });
    expect(getStock.execute).toHaveBeenCalledWith('p1');
  });

  it('delegates move to MoveStockUseCase with user id', async () => {
    const dto = {
      type: 'ENTRY' as const,
      quantity: 5,
      reason: 'Restock',
      idempotencyKey: 'k1',
    };
    const user: AuthenticatedUser = {
      id: 'u1',
      login: 'stock',
      role: UserRole.STOCK_MANAGER,
    };
    moveStock.execute.mockResolvedValue({ id: 'm1' });

    await expect(controller.move('p1', dto, user)).resolves.toEqual({
      id: 'm1',
    });
    expect(moveStock.execute).toHaveBeenCalledWith('p1', dto, 'u1');
  });

  it('delegates historyList to StockHistoryUseCase', async () => {
    const query = { from: '2026-01-01', to: '2026-01-02' };
    history.execute.mockResolvedValue([{ id: 'm1' }]);

    await expect(controller.historyList('p1', query)).resolves.toEqual([
      { id: 'm1' },
    ]);
    expect(history.execute).toHaveBeenCalledWith('p1', query);
  });

  it('delegates updateMinimum to UpdateStockMinimumUseCase', async () => {
    minimum.execute.mockResolvedValue({ productId: 'p1', minimumQuantity: 10 });

    await expect(
      controller.updateMinimum('p1', { minimumQuantity: 10 }),
    ).resolves.toEqual({ productId: 'p1', minimumQuantity: 10 });
    expect(minimum.execute).toHaveBeenCalledWith('p1', 10);
  });
});
