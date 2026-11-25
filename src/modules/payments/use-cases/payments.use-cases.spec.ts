import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import Stripe from 'stripe';
import {
  OrdersRepository,
  OrderStore,
} from 'src/modules/orders/repositories/orders.repository';
import { StripeGateway } from '../stripe.gateway';
import {
  CreatePaymentUseCase,
  ReversePaymentUseCase,
  StripeWebhookUseCase,
} from './payments.use-cases';

describe('Payment rules', () => {
  const lock = jest.fn();
  const createPayment = jest.fn();
  const updatePayment = jest.fn();
  const paymentFn = jest.fn();
  const paymentByTransaction = jest.fn();
  const store = { lock, createPayment, updatePayment } as unknown as OrderStore;
  const repository = {
    payment: paymentFn,
    paymentByTransaction,
    transaction: (work: (s: OrderStore) => Promise<unknown>) => work(store),
  } as unknown as OrdersRepository;
  const create = jest.fn();
  const createCheckoutSession = jest.fn();
  const retrieve = jest.fn();
  const cancel = jest.fn();
  const getRefund = jest.fn();
  const refund = jest.fn();
  const verify = jest.fn();
  const assertConfigured = jest.fn();
  const gateway = {
    create,
    createCheckoutSession,
    retrieve,
    cancel,
    getRefund,
    refund,
    verify,
    assertConfigured,
  } as unknown as StripeGateway;
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

  it('validates amount, receivedAmount, order existence, card retrieval and Stripe errors on create', async () => {
    await expect(
      useCase.execute(
        'order',
        { method: 'PIX', amount: '0', idempotencyKey: 'k' },
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(
        'order',
        {
          method: 'PIX',
          amount: '10.00',
          receivedAmount: '10.00',
          idempotencyKey: 'k',
        },
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '0.49', idempotencyKey: 'k' },
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);

    lock.mockResolvedValueOnce(null);
    await expect(
      useCase.execute(
        'missing',
        { method: 'PIX', amount: '10.00', idempotencyKey: 'k' },
        'u1',
      ),
    ).rejects.toThrow(NotFoundException);

    const cardPayment = {
      id: 'p1',
      orderId: 'order',
      amount: new Prisma.Decimal('12.50'),
      method: 'CREDIT_CARD',
      status: 'PENDING',
      transactionId: null,
      createdAt: new Date(),
    };
    createPayment.mockResolvedValueOnce(cardPayment);
    createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/c/pay/cs_1',
      payment_intent: 'pi_1',
    });
    updatePayment.mockResolvedValueOnce({
      ...cardPayment,
      transactionId: 'pi_1',
    });

    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '12.50', idempotencyKey: 'k2' },
        'u1',
      ),
    ).resolves.toEqual({
      payment: { ...cardPayment, transactionId: 'pi_1' },
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_1',
    });

    // Checkout session without immediate payment_intent returns pending payment and checkoutUrl
    lock.mockResolvedValue({
      status: 'CONFIRMED',
      total: new Prisma.Decimal('12.50'),
      payments: [
        {
          ...cardPayment,
          idempotencyKey: 'k3',
          receivedAmount: null,
          transactionId: null,
        },
      ],
    });
    createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_2',
      url: 'https://checkout.stripe.com/c/pay/cs_2',
      payment_intent: null,
    });
    await expect(
      useCase.execute(
        'order',
        {
          method: 'CREDIT_CARD',
          amount: '12.50',
          idempotencyKey: 'k3',
          successUrl: 'https://app.test/ok',
          cancelUrl: 'https://app.test/cancel',
        },
        'u1',
      ),
    ).resolves.toEqual({
      payment: {
        ...cardPayment,
        idempotencyKey: 'k3',
        receivedAmount: null,
        transactionId: null,
      },
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_2',
    });
    expect(createCheckoutSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'p1' }),
      'https://app.test/ok',
      'https://app.test/cancel',
    );

    // StripeInvalidRequestError 400 cancels local reservation
    lock.mockResolvedValue({
      status: 'CONFIRMED',
      total: new Prisma.Decimal('12.50'),
      payments: [
        {
          ...cardPayment,
          id: 'p1',
          idempotencyKey: 'k4',
          receivedAmount: null,
          transactionId: null,
        },
      ],
    });
    createPayment.mockResolvedValueOnce({ ...cardPayment, id: 'p1' });
    const invalidReq = new Stripe.errors.StripeInvalidRequestError({
      message: 'bad param',
      statusCode: 400,
    } as never);
    createCheckoutSession.mockRejectedValueOnce(invalidReq);
    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '12.50', idempotencyKey: 'k4' },
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(updatePayment).toHaveBeenCalledWith('p1', { status: 'CANCELLED' });

    // Network/5xx Stripe error throws ServiceUnavailableException
    createCheckoutSession.mockRejectedValueOnce(new Error('timeout'));
    await expect(
      useCase.execute(
        'order',
        { method: 'CREDIT_CARD', amount: '12.50', idempotencyKey: 'k4' },
        'u1',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  describe('ReversePaymentUseCase', () => {
    const reverseUseCase = new ReversePaymentUseCase(repository, gateway);

    it('handles missing payment, already reversed, invalid order status, and manual reversal', async () => {
      paymentFn.mockResolvedValueOnce(null);
      await expect(reverseUseCase.execute('missing', 'reason')).rejects.toThrow(
        NotFoundException,
      );

      paymentFn.mockResolvedValue({ id: 'p1', orderId: 'o1' });

      lock.mockResolvedValueOnce({
        status: 'CONFIRMED',
        payments: [{ id: 'p1', status: 'REFUNDED' }],
      });
      await expect(reverseUseCase.execute('p1', 'reason')).resolves.toEqual({
        id: 'p1',
        status: 'REFUNDED',
      });

      lock.mockResolvedValueOnce({
        status: 'PREPARING',
        payments: [{ id: 'p1', status: 'PAID' }],
      });
      await expect(reverseUseCase.execute('p1', 'reason')).rejects.toThrow(
        ConflictException,
      );

      lock.mockResolvedValueOnce({
        status: 'CONFIRMED',
        payments: [{ id: 'p1', status: 'PAID', provider: 'MANUAL' }],
      });
      updatePayment.mockResolvedValueOnce({ id: 'p1', status: 'REFUNDED' });
      await expect(reverseUseCase.execute('p1', 'reason')).resolves.toEqual({
        id: 'p1',
        status: 'REFUNDED',
      });

      lock.mockResolvedValueOnce({
        status: 'CONFIRMED',
        payments: [{ id: 'p1', status: 'PENDING', provider: 'MANUAL' }],
      });
      updatePayment.mockResolvedValueOnce({ id: 'p1', status: 'CANCELLED' });
      await expect(reverseUseCase.execute('p1', 'reason')).resolves.toEqual({
        id: 'p1',
        status: 'CANCELLED',
      });
    });

    it('handles Stripe reversal: missing transactionId, succeeded refund, pending refund, and cancel intent', async () => {
      paymentFn.mockResolvedValue({ id: 'p1', orderId: 'o1' });

      lock.mockResolvedValueOnce({
        status: 'CONFIRMED',
        payments: [
          {
            id: 'p1',
            status: 'PENDING',
            provider: 'STRIPE',
            transactionId: null,
          },
        ],
      });
      await expect(reverseUseCase.execute('p1', 'reason')).rejects.toThrow(
        ConflictException,
      );

      const stripePending = {
        id: 'p1',
        orderId: 'o1',
        amount: new Prisma.Decimal('10.00'),
        status: 'REFUND_PENDING',
        provider: 'STRIPE',
        transactionId: 'pi_1',
        refundId: null,
      };
      lock.mockResolvedValue({
        status: 'CONFIRMED',
        payments: [stripePending],
      });
      updatePayment.mockResolvedValueOnce(stripePending);
      retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        livemode: false,
        currency: 'brl',
        amount: 1000,
        status: 'succeeded',
        metadata: { paymentId: 'p1', orderId: 'o1' },
      });
      refund.mockResolvedValueOnce({ id: 're_1', status: 'succeeded' });
      updatePayment.mockResolvedValueOnce({
        ...stripePending,
        refundId: 're_1',
      });
      updatePayment.mockResolvedValueOnce({
        ...stripePending,
        status: 'REFUNDED',
        refundId: 're_1',
      });

      await expect(
        reverseUseCase.execute('p1', 'reason'),
      ).resolves.toMatchObject({
        status: 'REFUNDED',
        refundId: 're_1',
      });

      // Pending refund throws ConflictException
      updatePayment.mockResolvedValueOnce({
        ...stripePending,
        refundId: 're_1',
      });
      retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        livemode: false,
        currency: 'brl',
        amount: 1000,
        status: 'succeeded',
        metadata: { paymentId: 'p1', orderId: 'o1' },
      });
      getRefund.mockResolvedValueOnce({ id: 're_1', status: 'pending' });
      updatePayment.mockResolvedValueOnce({
        ...stripePending,
        refundId: 're_1',
      });

      await expect(reverseUseCase.execute('p1', 'reason')).rejects.toThrow(
        ConflictException,
      );

      // Non-succeeded, non-canceled intent cancels on Stripe
      updatePayment.mockResolvedValueOnce(stripePending);
      retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        livemode: false,
        currency: 'brl',
        amount: 1000,
        status: 'requires_payment_method',
        metadata: { paymentId: 'p1', orderId: 'o1' },
      });
      updatePayment.mockResolvedValueOnce({
        ...stripePending,
        status: 'CANCELLED',
      });
      await expect(
        reverseUseCase.execute('p1', 'reason'),
      ).resolves.toMatchObject({ status: 'CANCELLED' });
      expect(cancel).toHaveBeenCalledWith('pi_1');
    });
  });

  describe('StripeWebhookUseCase', () => {
    const webhookUseCase = new StripeWebhookUseCase(repository, gateway);

    it('rejects livemode events and ignores unhandled event types', async () => {
      verify.mockReturnValueOnce({ livemode: true, type: 'ping' });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(BadRequestException);

      verify.mockReturnValueOnce({ livemode: false, type: 'customer.created' });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
    });

    it('processes charge.refunded events and validates matching charge', async () => {
      const localPayment = {
        id: 'p1',
        orderId: 'o1',
        amount: new Prisma.Decimal('10.00'),
        provider: 'STRIPE',
        transactionId: 'pi_1',
        status: 'PAID',
        reversalReason: null,
      };

      verify.mockReturnValueOnce({
        livemode: false,
        type: 'charge.refunded',
        data: { object: { payment_intent: null, metadata: {} } },
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      verify.mockReturnValueOnce({
        livemode: false,
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: { id: 'pi_wrong' },
            metadata: { paymentId: 'p1' },
            livemode: false,
            currency: 'brl',
            amount: 1000,
            amount_refunded: 1000,
          },
        },
      });
      paymentByTransaction.mockResolvedValueOnce(null);
      paymentFn.mockResolvedValueOnce(localPayment);
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(BadRequestException);

      verify.mockReturnValueOnce({
        livemode: false,
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_1',
            metadata: { paymentId: 'p1' },
            livemode: false,
            currency: 'brl',
            amount: 1000,
            amount_refunded: 500,
          },
        },
      });
      paymentByTransaction.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({ payments: [localPayment] });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
      expect(updatePayment).toHaveBeenCalledWith('p1', {
        transactionId: 'pi_1',
        status: 'REFUND_PENDING',
        reversalReason: 'Stripe external refund',
      });

      // Already refunded is a no-op
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_1',
            livemode: false,
            currency: 'brl',
            amount: 1000,
            amount_refunded: 1000,
          },
        },
      });
      paymentByTransaction.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({
        payments: [{ ...localPayment, status: 'REFUNDED' }],
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
    });

    it('processes payment_intent.succeeded, canceled and payment_failed events', async () => {
      const localPayment = {
        id: 'p1',
        orderId: 'o1',
        amount: new Prisma.Decimal('10.00'),
        provider: 'STRIPE',
        transactionId: 'pi_1',
        status: 'PENDING',
      };
      const intentObj = {
        id: 'pi_1',
        livemode: false,
        currency: 'brl',
        amount: 1000,
        metadata: { paymentId: 'p1', orderId: 'o1' },
      };

      // Missing payment is ignored
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.succeeded',
        data: { object: { ...intentObj, metadata: {} } },
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      // Non-STRIPE provider throws BadRequestException
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.succeeded',
        data: { object: intentObj },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({
        payments: [{ ...localPayment, provider: 'MANUAL' }],
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(BadRequestException);

      // Non-PENDING status is a no-op
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.succeeded',
        data: { object: intentObj },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({
        payments: [{ ...localPayment, status: 'PAID' }],
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      // Succeeded marks PAID
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.succeeded',
        data: { object: intentObj },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({ payments: [localPayment] });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
      expect(updatePayment).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          status: 'PAID',
          paidAt: expect.any(Date) as Date,
        }),
      );

      // Canceled marks CANCELLED
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.canceled',
        data: { object: intentObj },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({ payments: [localPayment] });
      await webhookUseCase.execute(Buffer.from('{}'), 'sig');
      expect(updatePayment).toHaveBeenLastCalledWith('p1', {
        transactionId: 'pi_1',
        status: 'CANCELLED',
      });

      // Failed keeps PENDING
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'payment_intent.payment_failed',
        data: { object: intentObj },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({ payments: [localPayment] });
      await webhookUseCase.execute(Buffer.from('{}'), 'sig');
      expect(updatePayment).toHaveBeenLastCalledWith('p1', {
        transactionId: 'pi_1',
        status: 'PENDING',
      });

      // checkout.session.completed marks PAID and ignores missing or mismatched sessions
      verify.mockReturnValueOnce({
        livemode: false,
        type: 'checkout.session.completed',
        data: { object: { metadata: {} } },
      });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });

      verify.mockReturnValueOnce({
        livemode: false,
        type: 'checkout.session.completed',
        data: {
          object: {
            livemode: true,
            currency: 'brl',
            amount_total: 1000,
            metadata: { paymentId: 'p1' },
          },
        },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow(BadRequestException);

      verify.mockReturnValueOnce({
        livemode: false,
        type: 'checkout.session.completed',
        data: {
          object: {
            livemode: false,
            currency: 'brl',
            amount_total: 1000,
            payment_intent: 'pi_checkout_1',
            metadata: { paymentId: 'p1' },
          },
        },
      });
      paymentFn.mockResolvedValueOnce(localPayment);
      lock.mockResolvedValueOnce({ payments: [localPayment] });
      await expect(
        webhookUseCase.execute(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
      expect(updatePayment).toHaveBeenLastCalledWith(
        'p1',
        expect.objectContaining({
          transactionId: 'pi_checkout_1',
          status: 'PAID',
          paidAt: expect.any(Date) as Date,
        }),
      );
    });
  });
});
