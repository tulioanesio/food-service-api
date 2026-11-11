import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Payment, Prisma } from 'src/generated/prisma/client';
import Stripe from 'stripe';
import { OrdersRepository } from 'src/modules/orders/repositories/orders.repository';
import { CreatePaymentDto } from '../dto/payment.dto';
import { StripeGateway } from '../stripe.gateway';

function isCard(method: string) {
  return ['CREDIT_CARD', 'DEBIT_CARD'].includes(method);
}
function checkIntent(payment: Payment, intent: Stripe.PaymentIntent) {
  if (
    intent.livemode ||
    intent.currency !== 'brl' ||
    intent.amount !== payment.amount.mul(100).toNumber() ||
    intent.metadata.paymentId !== payment.id ||
    intent.metadata.orderId !== payment.orderId ||
    (payment.transactionId && payment.transactionId !== intent.id)
  )
    throw new BadRequestException(
      'Stripe payment does not match local payment',
    );
}
@Injectable()
export class CreatePaymentUseCase {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly stripe: StripeGateway,
  ) {}
  async execute(orderId: string, dto: CreatePaymentDto, userId: string) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.gt(0)) throw new BadRequestException('Amount must be positive');
    const card = isCard(dto.method);
    if (card) this.stripe.assertConfigured();
    if (card && amount.lt('0.50'))
      throw new BadRequestException(
        'Stripe BRL payments require at least 0.50',
      );
    if (dto.method !== 'CASH' && dto.receivedAmount !== undefined)
      throw new BadRequestException('Received amount is only valid for cash');
    const received =
      dto.receivedAmount === undefined
        ? null
        : new Prisma.Decimal(dto.receivedAmount);
    if (dto.method === 'CASH' && (!received || received.lt(amount)))
      throw new BadRequestException('Cash received must cover payment amount');
    const payment = await this.repository.transaction(async (store) => {
      const order = await store.lock(orderId);
      if (!order) throw new NotFoundException('Order not found');
      const existing = order.payments.find(
        (p) => p.idempotencyKey === dto.idempotencyKey,
      );
      if (existing) {
        if (
          !existing.amount.eq(amount) ||
          existing.method !== dto.method ||
          (existing.receivedAmount?.toString() ?? null) !==
            (received?.toString() ?? null)
        )
          throw new ConflictException(
            'Idempotency key already used with different parameters',
          );
        return existing;
      }
      if (!['CONFIRMED', 'PREPARING', 'READY'].includes(order.status))
        throw new ConflictException('Order is not eligible for payment');
      const reserved = order.payments
        .filter((p) => ['PAID', 'PENDING', 'REFUND_PENDING'].includes(p.status))
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      if (reserved.add(amount).gt(order.total))
        throw new ConflictException('Amount exceeds unreserved balance');
      return store.createPayment({
        orderId,
        receivedById: userId,
        method: dto.method,
        amount,
        idempotencyKey: dto.idempotencyKey,
        provider: card ? 'STRIPE' : 'MANUAL',
        status: card ? 'PENDING' : 'PAID',
        paidAt: card ? null : new Date(),
        receivedAmount: received,
        change: received?.sub(amount),
      });
    });
    if (!card || payment.status !== 'PENDING') return { payment };
    // Never reuse a possibly expired Stripe idempotency key for an unknown result.
    if (
      !payment.transactionId &&
      Date.now() - payment.createdAt.getTime() > 23 * 60 * 60 * 1000
    )
      throw new ConflictException(
        'Unresolved Stripe creation: reconcile the payment before retrying',
      );
    let intent: Stripe.PaymentIntent;
    try {
      intent = payment.transactionId
        ? await this.stripe.retrieve(payment.transactionId)
        : await this.stripe.create(payment);
    } catch (error) {
      // A definitive parameter rejection created no remote payment. Network/5xx
      // failures remain reserved because the remote outcome is unknown.
      if (
        !payment.transactionId &&
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.statusCode === 400
      ) {
        await this.repository.transaction(async (store) => {
          const order = await store.lock(orderId);
          const current = order!.payments.find((p) => p.id === payment.id)!;
          if (current.status === 'PENDING' && !current.transactionId)
            await store.updatePayment(payment.id, { status: 'CANCELLED' });
        });
        throw new BadRequestException(
          'Stripe rejected payment parameters; correct them and use a new idempotency key',
        );
      }
      throw new ServiceUnavailableException(
        'Stripe is unavailable; retry using the same idempotency key',
      );
    }
    checkIntent(payment, intent);
    const updated = await this.repository.transaction(async (store) => {
      await store.lock(orderId);
      return store.updatePayment(payment.id, { transactionId: intent.id });
    });
    return { payment: updated, clientSecret: intent.client_secret };
  }
}
@Injectable()
export class ReversePaymentUseCase {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly stripe: StripeGateway,
  ) {}
  async execute(id: string, reason: string) {
    const found = await this.repository.payment(id);
    if (!found) throw new NotFoundException('Payment not found');
    const payment = await this.repository.transaction(async (store) => {
      const order = await store.lock(found.orderId);
      const current = order!.payments.find((p) => p.id === id)!;
      if (['CANCELLED', 'REFUNDED'].includes(current.status)) return current;
      if (!['CONFIRMED', 'OPEN'].includes(order!.status))
        throw new ConflictException(
          'Reversal is only allowed before preparation',
        );
      if (current.provider === 'MANUAL')
        return store.updatePayment(id, {
          status: current.status === 'PAID' ? 'REFUNDED' : 'CANCELLED',
          reversalReason: reason,
        });
      if (!current.transactionId)
        throw new ConflictException(
          'Retry original payment request to recover the Stripe intent first',
        );
      return store.updatePayment(id, {
        status: 'REFUND_PENDING',
        reversalReason: reason,
      });
    });
    if (payment.status !== 'REFUND_PENDING') return payment;
    const intent = await this.stripe.retrieve(payment.transactionId!);
    checkIntent(payment, intent);
    let refundId: string | undefined;
    if (intent.status === 'succeeded') {
      const refund = payment.refundId
        ? await this.stripe.getRefund(payment.refundId)
        : await this.stripe.refund(intent.id);
      await this.repository.transaction(async (store) => {
        await store.lock(payment.orderId);
        return store.updatePayment(id, { refundId: refund.id });
      });
      if (refund.status !== 'succeeded')
        throw new ConflictException('Refund is pending; retry to reconcile');
      refundId = refund.id;
    } else if (intent.status !== 'canceled') {
      await this.stripe.cancel(intent.id);
    }
    return this.repository.transaction(async (store) => {
      await store.lock(payment.orderId);
      return store.updatePayment(id, {
        status: refundId ? 'REFUNDED' : 'CANCELLED',
        refundId,
        reversalReason: reason,
      });
    });
  }
}
@Injectable()
export class StripeWebhookUseCase {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly stripe: StripeGateway,
  ) {}
  async execute(body: Buffer | undefined, signature: string | undefined) {
    const event = this.stripe.verify(body, signature);
    if (event.livemode)
      throw new BadRequestException('Live Stripe events are disabled');
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      const payment =
        (intentId
          ? await this.repository.paymentByTransaction(intentId)
          : null) ??
        (charge.metadata?.paymentId
          ? await this.repository.payment(charge.metadata.paymentId)
          : null);
      if (!payment) return { received: true };
      if (
        !intentId ||
        (payment.transactionId !== null &&
          payment.transactionId !== intentId) ||
        charge.livemode ||
        charge.currency !== 'brl' ||
        charge.amount !== payment.amount.mul(100).toNumber() ||
        payment.provider !== 'STRIPE'
      )
        throw new BadRequestException('Refund does not match local payment');
      await this.repository.transaction(async (store) => {
        const order = await store.lock(payment.orderId);
        const current = order!.payments.find((p) => p.id === payment.id)!;
        if (current.status === 'REFUNDED') return;
        await store.updatePayment(payment.id, {
          transactionId: intentId,
          status:
            charge.amount_refunded === charge.amount
              ? 'REFUNDED'
              : 'REFUND_PENDING',
          reversalReason: current.reversalReason ?? 'Stripe external refund',
        });
      });
      return { received: true };
    }
    if (
      ![
        'payment_intent.succeeded',
        'payment_intent.canceled',
        'payment_intent.payment_failed',
      ].includes(event.type)
    )
      return { received: true };
    const intent = event.data.object as Stripe.PaymentIntent;
    const payment = intent.metadata?.paymentId
      ? await this.repository.payment(intent.metadata.paymentId)
      : null;
    // Ignore unrelated Stripe account activity, including CLI-generated fixtures.
    if (!payment) return { received: true };
    checkIntent(payment, intent);
    await this.repository.transaction(async (store) => {
      const order = await store.lock(payment.orderId);
      const current = order!.payments.find((p) => p.id === payment.id)!;
      checkIntent(current, intent);
      if (current.provider !== 'STRIPE')
        throw new BadRequestException('Invalid payment provider');
      if (current.status !== 'PENDING') return;
      const status =
        event.type === 'payment_intent.succeeded'
          ? 'PAID'
          : event.type === 'payment_intent.canceled'
            ? 'CANCELLED'
            : 'PENDING';
      // A declined intent may be retried; keep its balance reserved until canceled.
      await store.updatePayment(payment.id, {
        transactionId: intent.id,
        status,
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      });
    });
    return { received: true };
  }
}
