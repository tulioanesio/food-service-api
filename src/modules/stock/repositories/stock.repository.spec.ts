import { PrismaService } from 'src/prisma/prisma.service';
import { StockRepository, StockStore } from './stock.repository';

describe('StockRepository', () => {
  const db = {
    product: { findUnique: jest.fn() },
    stock: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      fields: { minimumQuantity: 'minimumQuantityRef' },
    },
    stockMovement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const repository = new StockRepository(db as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('finds product metadata by id', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1', isActive: true });

    await expect(repository.product('p1')).resolves.toEqual({
      id: 'p1',
      isActive: true,
    });
    expect(db.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      select: { id: true, isActive: true, deletedAt: true },
    });
  });

  it('locks stock row with upsert and FOR UPDATE', async () => {
    db.stock.findUniqueOrThrow.mockResolvedValue({
      productId: 'p1',
      totalQuantity: 10,
    });

    await expect(repository.lock('p1')).resolves.toEqual({
      productId: 'p1',
      totalQuantity: 10,
    });
    expect(db.stock.upsert).toHaveBeenCalledWith({
      where: { productId: 'p1' },
      create: { productId: 'p1' },
      update: {},
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.stock.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { productId: 'p1' },
    });
  });

  it('finds stock with product include', async () => {
    db.stock.findUnique.mockResolvedValue({ productId: 'p1' });

    await expect(repository.find('p1')).resolves.toEqual({ productId: 'p1' });
    expect(db.stock.findUnique).toHaveBeenCalledWith({
      where: { productId: 'p1' },
      include: {
        product: {
          select: { id: true, name: true, category: true, isActive: true },
        },
      },
    });
  });

  it('lists stock with and without lowStock filter', async () => {
    db.stock.findMany.mockResolvedValue([{ productId: 'p1' }]);

    await repository.list(false);
    expect(db.stock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, take: 100 }),
    );

    await repository.list(true);
    expect(db.stock.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { totalQuantity: { lt: 'minimumQuantityRef' } },
        take: 100,
      }),
    );
  });

  it('queries previous movement, updates stock, creates movement and lists history', async () => {
    db.stockMovement.findUnique.mockResolvedValue({ id: 'm1' });
    db.stock.update.mockResolvedValue({ productId: 'p1', minimumQuantity: 5 });
    db.stockMovement.create.mockResolvedValue({ id: 'm2' });
    db.stockMovement.findMany.mockResolvedValue([{ id: 'm2' }]);

    await expect(repository.previous('p1', 'k1')).resolves.toEqual({
      id: 'm1',
    });
    await expect(
      repository.update('p1', { minimumQuantity: 5 }),
    ).resolves.toEqual({ productId: 'p1', minimumQuantity: 5 });
    await expect(
      repository.movement({
        productId: 'p1',
        userId: 'u1',
        type: 'ENTRY',
        quantity: 2,
        reason: 'r',
        idempotencyKey: 'k2',
      }),
    ).resolves.toEqual({ id: 'm2' });
    await expect(repository.history({ productId: 'p1' })).resolves.toEqual([
      { id: 'm2' },
    ]);
  });

  it('executes work inside a transaction with a StockStore instance', async () => {
    db.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    );

    const result = await repository.transaction((store) => {
      expect(store).toBeInstanceOf(StockStore);
      return Promise.resolve('ok');
    });

    expect(result).toBe('ok');
  });
});
