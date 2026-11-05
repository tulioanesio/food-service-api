import { ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import {
  OrdersRepository,
  OrderStore,
} from '../repositories/orders.repository';
import { CreateOrderUseCase, TransitionOrderUseCase } from './orders.use-cases';

describe('Order business rules', () => {
  const store = {
    products: jest.fn(),
    create: jest.fn(),
    lock: jest.fn(),
    debit: jest.fn(),
    update: jest.fn(),
    movement: jest.fn(),
    restore: jest.fn(),
  };
  const repository = {
    transaction: (fn: (s: OrderStore) => Promise<unknown>) =>
      fn(store as unknown as OrderStore),
  } as OrdersRepository;
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
});
