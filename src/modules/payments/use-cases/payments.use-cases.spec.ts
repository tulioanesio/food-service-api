import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import {
  OrdersRepository,
  OrderStore,
} from 'src/modules/orders/repositories/orders.repository';
import { StripeGateway } from '../stripe.gateway';
import { CreatePaymentUseCase } from './payments.use-cases';

describe('Payment rules', () => {
  const lock = jest.fn();
  const createPayment = jest.fn();
  const updatePayment = jest.fn();
  const store = { lock, createPayment, updatePayment } as unknown as OrderStore;
  const repository = {
    transaction: (work: (s: OrderStore) => Promise<unknown>) => work(store),
  } as OrdersRepository;
  const create = jest.fn();
  const assertConfigured = jest.fn();
  const gateway = { create, assertConfigured } as unknown as StripeGateway;
  const useCase = new CreatePaymentUseCase(repository, gateway);
  const dto = {
    method: 'CASH' as const,
    amount: '12.50',
    receivedAmount: '20.00',
    idempotencyKey: 'key',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    lock.mockResolvedValue({
      status: 'CONFIRMED',
      total: new Prisma.Decimal('12.50'),
      payments: [],
    });
  });
  it('stores only the applied amount as revenue and computes change exactly', async () => {
    await useCase.execute('order', dto, 'cashier');
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Prisma.Decimal('12.50'),
        receivedAmount: new Prisma.Decimal('20'),
        change: new Prisma.Decimal('7.50'),
        status: 'PAID',
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });
  it.each(['0', '-1'])('rejects non-positive amount %s', async (amount) => {
    await expect(
      useCase.execute('order', { ...dto, amount }, 'cashier'),
    ).rejects.toThrow(BadRequestException);
    expect(createPayment).not.toHaveBeenCalled();
  });
  it('rejects insufficient cash and cash fields on other methods', async () => {
    await expect(
      useCase.execute('order', { ...dto, receivedAmount: '10' }, 'cashier'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      useCase.execute('order', { ...dto, method: 'PIX' }, 'cashier'),
    ).rejects.toThrow(BadRequestException);
  });
  it.each(['OPEN', 'CANCELLED', 'COMPLETED'])(
    'rejects new payments for %s',
    async (status) => {
      lock.mockResolvedValue({ status, payments: [] });
      await expect(useCase.execute('order', dto, 'cashier')).rejects.toThrow(
        ConflictException,
      );
    },
  );
  it.each(['PENDING', 'PAID', 'REFUND_PENDING'])(
    'reserves the balance for %s',
    async (status) => {
      lock.mockResolvedValue({
        status: 'CONFIRMED',
        total: new Prisma.Decimal('12.50'),
        payments: [{ status, amount: new Prisma.Decimal('1') }],
      });
      await expect(useCase.execute('order', dto, 'cashier')).rejects.toThrow(
        ConflictException,
      );
    },
  );
  it('rejects inconsistent reuse of an idempotency key', async () => {
    lock.mockResolvedValue({
      payments: [
        {
          idempotencyKey: 'key',
          amount: new Prisma.Decimal(1),
          method: 'CASH',
        },
      ],
    });
    await expect(useCase.execute('order', dto, 'cashier')).rejects.toThrow(
      ConflictException,
    );
  });
  it('checks Stripe configuration before creating a reservation', async () => {
    assertConfigured.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '12.50', idempotencyKey: 'key' },
        'cashier',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(lock).not.toHaveBeenCalled();
  });
  it('never creates another intent using an expired idempotency key', async () => {
    lock.mockResolvedValue({
      payments: [
        {
          id: 'payment',
          idempotencyKey: 'key',
          amount: new Prisma.Decimal('12.50'),
          method: 'CREDIT_CARD',
          status: 'PENDING',
          receivedAmount: null,
          transactionId: null,
          createdAt: new Date(0),
        },
      ],
    });
    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '12.50', idempotencyKey: 'key' },
        'cashier',
      ),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });
});
