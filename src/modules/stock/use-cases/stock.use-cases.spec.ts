import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StockRepository, StockStore } from '../repositories/stock.repository';
import {
  GetStockUseCase,
  ListStockUseCase,
  MoveStockUseCase,
  StockHistoryUseCase,
  UpdateStockMinimumUseCase,
} from './stock.use-cases';

describe('Stock business rules', () => {
  const store = {
    product: jest.fn(),
    lock: jest.fn(),
    previous: jest.fn(),
    update: jest.fn(),
    movement: jest.fn(),
    history: jest.fn(),
    find: jest.fn(),
    list: jest.fn(),
  };
  const repository = {
    ...store,
    transaction: (work: (s: StockStore) => Promise<unknown>) =>
      work(store as unknown as StockStore),
  } as unknown as StockRepository;
  const useCase = new MoveStockUseCase(repository);
  const dto = {
    type: 'ENTRY' as const,
    quantity: 3,
    reason: 'Delivery',
    idempotencyKey: 'key',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    store.product.mockResolvedValue({
      id: 'p',
      isActive: true,
      deletedAt: null,
    });
    store.lock.mockResolvedValue({
      totalQuantity: 5,
      inputQuantity: 5,
      outputQuantity: 0,
    });
    store.previous.mockResolvedValue(null);
  });
  it('records entries with the responsible user and increments incoming totals', async () => {
    await useCase.execute('p', dto, 'operator');
    expect(store.update).toHaveBeenCalledWith('p', {
      totalQuantity: { increment: 3 },
      inputQuantity: { increment: 3 },
      outputQuantity: { increment: 0 },
    });
    expect(store.movement).toHaveBeenCalledWith({
      ...dto,
      productId: 'p',
      userId: 'operator',
    });
  });
  it.each(['EXIT', 'LOSS', 'ADJUSTMENT'] as const)(
    'decrements stock for %s and tracks outgoing units',
    async (type) => {
      await useCase.execute(
        'p',
        { ...dto, type, quantity: type === 'ADJUSTMENT' ? -3 : 3 },
        'operator',
      );
      expect(store.update).toHaveBeenCalledWith('p', {
        totalQuantity: { increment: -3 },
        inputQuantity: { increment: 0 },
        outputQuantity: { increment: 3 },
      });
    },
  );
  it('supports positive adjustments', async () => {
    await useCase.execute('p', { ...dto, type: 'ADJUSTMENT' }, 'operator');
    expect(store.update).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ totalQuantity: { increment: 3 } }),
    );
  });
  it.each([0, -1, 1.5])('rejects invalid entry quantity %s', (quantity) => {
    expect(() =>
      useCase.execute('p', { ...dto, quantity }, 'operator'),
    ).toThrow(BadRequestException);
    expect(store.update).not.toHaveBeenCalled();
  });
  it('rejects insufficient stock without recording a movement', async () => {
    await expect(
      useCase.execute('p', { ...dto, type: 'LOSS', quantity: 6 }, 'operator'),
    ).rejects.toThrow(ConflictException);
    expect(store.movement).not.toHaveBeenCalled();
  });
  it('replays the same operation without altering stock again', async () => {
    store.previous.mockResolvedValue({ id: 'movement', ...dto });
    await expect(useCase.execute('p', dto, 'operator')).resolves.toMatchObject({
      id: 'movement',
    });
    expect(store.update).not.toHaveBeenCalled();
  });
  it('rejects reuse of a key with a different movement', async () => {
    store.previous.mockResolvedValue({ ...dto, quantity: 1 });
    await expect(useCase.execute('p', dto, 'operator')).rejects.toThrow(
      ConflictException,
    );
  });
  it('rejects nonexistent and inactive products', async () => {
    store.product.mockResolvedValueOnce(null);
    await expect(useCase.execute('p', dto, 'operator')).rejects.toThrow(
      NotFoundException,
    );
    store.product.mockResolvedValueOnce({ isActive: false });
    await expect(useCase.execute('p', dto, 'operator')).rejects.toThrow(
      ConflictException,
    );
  });
  it('rejects integer counter overflow', async () => {
    store.lock.mockResolvedValue({
      totalQuantity: 5,
      inputQuantity: 2147483647,
      outputQuantity: 0,
    });
    await expect(useCase.execute('p', dto, 'operator')).rejects.toThrow(
      ConflictException,
    );
  });
  it('rejects an inverted history date range', async () => {
    await expect(
      new StockHistoryUseCase(repository).execute('p', {
        from: '2026-11-05',
        to: '2026-11-04',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('gets stock with lowStock flag and throws NotFoundException when missing', async () => {
    const getStock = new GetStockUseCase(repository);
    store.find.mockResolvedValueOnce(null);
    await expect(getStock.execute('missing')).rejects.toThrow(
      NotFoundException,
    );

    store.find.mockResolvedValueOnce({
      productId: 'p',
      totalQuantity: 2,
      minimumQuantity: 5,
    });
    await expect(getStock.execute('p')).resolves.toEqual({
      productId: 'p',
      totalQuantity: 2,
      minimumQuantity: 5,
      lowStock: true,
    });
  });

  it('lists stock with default and explicit lowStock flag', async () => {
    const listStock = new ListStockUseCase(repository);
    store.list.mockResolvedValue([{ productId: 'p' }]);

    await expect(listStock.execute()).resolves.toEqual([{ productId: 'p' }]);
    expect(store.list).toHaveBeenCalledWith(false);

    await expect(listStock.execute(true)).resolves.toEqual([
      { productId: 'p' },
    ]);
    expect(store.list).toHaveBeenLastCalledWith(true);
  });

  it('returns stock history or throws NotFoundException when product does not exist', async () => {
    const historyUseCase = new StockHistoryUseCase(repository);
    store.product.mockResolvedValueOnce(null);
    await expect(historyUseCase.execute('missing', {})).rejects.toThrow(
      NotFoundException,
    );

    store.history.mockResolvedValueOnce([{ id: 'm1' }]);
    await expect(
      historyUseCase.execute('p', {
        type: 'ENTRY',
        userId: 'u1',
        from: '2026-11-01',
        to: '2026-11-05',
      }),
    ).resolves.toEqual([{ id: 'm1' }]);
    expect(store.history).toHaveBeenCalledWith({
      productId: 'p',
      type: 'ENTRY',
      userId: 'u1',
      createdAt: { gte: '2026-11-01', lte: '2026-11-05' },
    });
  });

  it('updates stock minimum or throws NotFoundException when product does not exist', async () => {
    const minimumUseCase = new UpdateStockMinimumUseCase(repository);
    store.product.mockResolvedValueOnce(null);
    await expect(minimumUseCase.execute('missing', 10)).rejects.toThrow(
      NotFoundException,
    );

    store.update.mockResolvedValueOnce({ productId: 'p', minimumQuantity: 10 });
    await expect(minimumUseCase.execute('p', 10)).resolves.toEqual({
      productId: 'p',
      minimumQuantity: 10,
    });
    expect(store.lock).toHaveBeenCalledWith('p');
    expect(store.update).toHaveBeenCalledWith('p', { minimumQuantity: 10 });
  });
});
