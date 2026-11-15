import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import {
  OrdersRepository,
  OrderStore,
} from '../repositories/orders.repository';
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  TransitionOrderUseCase,
} from './orders.use-cases';

describe('Order business rules', () => {
  const store = {
    products: jest.fn(),
    customer: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    lock: jest.fn(),
    debit: jest.fn(),
    update: jest.fn(),
    movement: jest.fn(),
    restore: jest.fn(),
  };
  const repository = {
    ...store,
    transaction: (fn: (s: OrderStore) => Promise<unknown>) =>
      fn(store as unknown as OrderStore),
  } as unknown as OrdersRepository;
  beforeEach(() => jest.resetAllMocks());
  it('calculates with Decimal and consolidates products', async () => {
    store.products.mockResolvedValue([
      { id: 'p', price: new Prisma.Decimal('0.10') },
    ]);
    await new CreateOrderUseCase(repository).execute({
      items: [
        { productId: 'p', quantity: 1 },
        { productId: 'p', quantity: 2 },
      ],
    });
    const calls = store.create.mock.calls as [Prisma.OrderCreateInput][];
    const data = calls[0][0];
    expect((data.total as Prisma.Decimal).toString()).toBe('0.3');
    expect(data.items).toMatchObject({ create: [{ quantity: 3 }] });
  });
  it('rejects inactive or missing products', async () => {
    store.products.mockResolvedValue([]);
    await expect(
      new CreateOrderUseCase(repository).execute({
        items: [{ productId: 'p', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(store.create).not.toHaveBeenCalled();
  });
  it('does not debit stock twice for repeated confirmation', async () => {
    store.lock.mockResolvedValue({ status: 'CONFIRMED' });
    await new TransitionOrderUseCase(repository).execute('o', 'CONFIRMED', 'u');
    expect(store.debit).not.toHaveBeenCalled();
  });
  it.each(['PREPARING', 'READY', 'COMPLETED'])(
    'forbids cancellation after preparation: %s',
    async (status) => {
      store.lock.mockResolvedValue({ status });
      await expect(
        new TransitionOrderUseCase(repository).execute(
          'o',
          'CANCELLED',
          'u',
          'reason',
        ),
      ).rejects.toThrow(ConflictException);
      expect(store.restore).not.toHaveBeenCalled();
    },
  );
  it('pending payments never settle the order', async () => {
    store.lock.mockResolvedValue({
      status: 'READY',
      total: new Prisma.Decimal(10),
      payments: [{ status: 'PENDING', amount: new Prisma.Decimal(10) }],
    });
    await expect(
      new TransitionOrderUseCase(repository).execute('o', 'COMPLETED', 'u'),
    ).rejects.toThrow(ConflictException);
  });
  it('blocks preparation while a refund result is unresolved', async () => {
    store.lock.mockResolvedValue({
      status: 'CONFIRMED',
      payments: [{ status: 'REFUND_PENDING' }],
    });
    await expect(
      new TransitionOrderUseCase(repository).execute('o', 'PREPARING', 'u'),
    ).rejects.toThrow(ConflictException);
  });

  it('validates customer existence and order total limit on create', async () => {
    store.customer.mockResolvedValueOnce(null);
    await expect(
      new CreateOrderUseCase(repository).execute({
        customerId: 'missing',
        items: [{ productId: 'p', quantity: 1 }],
      }),
    ).rejects.toThrow(NotFoundException);

    store.customer.mockResolvedValueOnce({ id: 'c1' });
    store.products.mockResolvedValueOnce([
      { id: 'p', price: new Prisma.Decimal('100000000.00') },
    ]);
    await expect(
      new CreateOrderUseCase(repository).execute({
        customerId: 'c1',
        items: [{ productId: 'p', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('gets order with paid and remaining amounts or throws NotFoundException', async () => {
    store.get.mockResolvedValueOnce(null);
    await expect(
      new GetOrderUseCase(repository).execute('missing'),
    ).rejects.toThrow(NotFoundException);

    store.get.mockResolvedValueOnce({
      id: 'o1',
      total: new Prisma.Decimal('50.00'),
      payments: [{ status: 'PAID', amount: new Prisma.Decimal('20.00') }],
    });
    const order = await new GetOrderUseCase(repository).execute('o1');
    expect(order.paidAmount.toString()).toBe('20');
    expect(order.remainingAmount.toString()).toBe('30');
  });

  it('lists orders and rejects inverted date ranges', async () => {
    expect(() =>
      new ListOrdersUseCase(repository).execute({
        from: '2026-01-02',
        to: '2026-01-01',
      }),
    ).toThrow(BadRequestException);

    store.list.mockResolvedValueOnce([{ id: 'o1' }]);
    await expect(
      new ListOrdersUseCase(repository).execute({ status: 'OPEN' }),
    ).resolves.toEqual([{ id: 'o1' }]);
  });

  it('handles missing order, invalid transitions, and cancellation rules', async () => {
    const transition = new TransitionOrderUseCase(repository);

    store.lock.mockResolvedValueOnce(null);
    await expect(
      transition.execute('missing', 'CONFIRMED', 'u1'),
    ).rejects.toThrow(NotFoundException);

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [{ status: 'PAID' }],
      items: [],
    });
    await expect(
      transition.execute('o1', 'CANCELLED', 'u1', 'reason'),
    ).rejects.toThrow(ConflictException);

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [],
      items: [],
    });
    await expect(
      transition.execute('o1', 'CANCELLED', 'u1', '   '),
    ).rejects.toThrow(BadRequestException);

    store.lock.mockResolvedValueOnce({
      status: 'CONFIRMED',
      payments: [],
      items: [
        { productId: 'p2', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ],
    });
    store.update.mockResolvedValueOnce({ id: 'o1', status: 'CANCELLED' });
    await expect(
      transition.execute('o1', 'CANCELLED', 'u1', 'Out of ingredients'),
    ).resolves.toEqual({ id: 'o1', status: 'CANCELLED' });
    expect(store.restore).toHaveBeenCalledTimes(2);
    expect(store.movement).toHaveBeenCalledTimes(2);

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [],
      items: [],
    });
    await expect(transition.execute('o1', 'READY', 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('confirms order with stock debit and validates inactive/insufficient stock', async () => {
    const transition = new TransitionOrderUseCase(repository);

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [],
      items: [{ productId: 'p1', quantity: 1 }],
    });
    store.products.mockResolvedValueOnce([]);
    await expect(transition.execute('o1', 'CONFIRMED', 'u1')).rejects.toThrow(
      ConflictException,
    );

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [],
      items: [{ productId: 'p1', quantity: 5 }],
    });
    store.products.mockResolvedValueOnce([{ id: 'p1' }]);
    store.debit.mockResolvedValueOnce({ count: 0 });
    await expect(transition.execute('o1', 'CONFIRMED', 'u1')).rejects.toThrow(
      ConflictException,
    );

    store.lock.mockResolvedValueOnce({
      status: 'OPEN',
      payments: [],
      items: [
        { productId: 'p2', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ],
    });
    store.products.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]);
    store.debit.mockResolvedValue({ count: 1 });
    store.update.mockResolvedValueOnce({ id: 'o1', status: 'CONFIRMED' });

    await expect(transition.execute('o1', 'CONFIRMED', 'u1')).resolves.toEqual({
      id: 'o1',
      status: 'CONFIRMED',
    });
    expect(store.movement).toHaveBeenCalledTimes(2);
  });
});
