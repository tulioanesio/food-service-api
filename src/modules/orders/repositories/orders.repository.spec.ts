import { PrismaService } from 'src/prisma/prisma.service';
import {
  orderInclude,
  OrdersRepository,
  OrderStore,
} from './orders.repository';

describe('OrdersRepository', () => {
  const db = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: { findMany: jest.fn() },
    customer: { findUnique: jest.fn() },
    stock: { updateMany: jest.fn(), update: jest.fn() },
    stockMovement: { create: jest.fn() },
    payment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const repository = new OrdersRepository(db as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('locks and fetches an order', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o1' });

    await expect(repository.lock('o1')).resolves.toEqual({ id: 'o1' });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'o1' },
      include: orderInclude,
    });
  });

  it('lists orders, finds products and customer', async () => {
    db.order.findMany.mockResolvedValue([{ id: 'o1' }]);
    db.product.findMany.mockResolvedValue([{ id: 'p1' }]);
    db.customer.findUnique.mockResolvedValue({ id: 'c1' });

    await expect(repository.list({ status: 'OPEN' })).resolves.toEqual([
      { id: 'o1' },
    ]);
    expect(db.order.findMany).toHaveBeenCalledWith({
      where: { status: 'OPEN' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    await expect(repository.products(['p1'])).resolves.toEqual([{ id: 'p1' }]);
    expect(db.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1'] }, isActive: true, deletedAt: null },
    });

    await expect(repository.customer('c1')).resolves.toEqual({ id: 'c1' });
    expect(db.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: { id: true },
    });
  });

  it('creates and updates orders', async () => {
    db.order.create.mockResolvedValue({ id: 'o1' });
    db.order.update.mockResolvedValue({ id: 'o1', status: 'CONFIRMED' });

    await expect(repository.create({ total: 10 })).resolves.toEqual({
      id: 'o1',
    });
    expect(db.order.create).toHaveBeenCalledWith({
      data: { total: 10 },
      include: orderInclude,
    });

    await expect(
      repository.update('o1', { status: 'CONFIRMED' }),
    ).resolves.toEqual({ id: 'o1', status: 'CONFIRMED' });
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CONFIRMED' },
      include: orderInclude,
    });
  });

  it('debits/restores stock and records stock movement', async () => {
    db.stock.updateMany.mockResolvedValue({ count: 1 });
    db.stock.update.mockResolvedValue({ productId: 'p1' });
    db.stockMovement.create.mockResolvedValue({ id: 'm1' });

    await expect(repository.debit('p1', 2)).resolves.toEqual({ count: 1 });
    await expect(repository.restore('p1', 2)).resolves.toEqual({
      productId: 'p1',
    });
    await expect(
      repository.movement({
        productId: 'p1',
        userId: 'u1',
        type: 'EXIT',
        quantity: 2,
        reason: 'order',
      }),
    ).resolves.toEqual({ id: 'm1' });
  });

  it('queries, creates and updates payments', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'pay1' });
    db.payment.create.mockResolvedValue({ id: 'pay1' });
    db.payment.update.mockResolvedValue({ id: 'pay1', status: 'PAID' });

    await expect(repository.paymentByTransaction('tx1')).resolves.toEqual({
      id: 'pay1',
    });
    await expect(repository.payment('pay1')).resolves.toEqual({ id: 'pay1' });
    await expect(
      repository.createPayment({
        orderId: 'o1',
        method: 'CASH',
        amount: 10,
        status: 'PAID',
      }),
    ).resolves.toEqual({ id: 'pay1' });
    await expect(
      repository.updatePayment('pay1', { status: 'PAID' }),
    ).resolves.toEqual({ id: 'pay1', status: 'PAID' });
  });

  it('executes work inside a 30s transaction with OrderStore', async () => {
    db.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    );

    const result = await repository.transaction((store) => {
      expect(store).toBeInstanceOf(OrderStore);
      return Promise.resolve('done');
    });

    expect(result).toBe('done');
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 30000,
    });
  });
});
