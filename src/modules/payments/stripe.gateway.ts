import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from 'src/generated/prisma/client';
@Injectable()
export class StripeGateway {
  constructor(private readonly config: ConfigService) {}
  private client() {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key?.startsWith('sk_test_'))
      throw new ServiceUnavailableException(
        'Stripe test key is not configured',
      );
    return new Stripe(key, { timeout: 10000, maxNetworkRetries: 1 });
  }
  assertConfigured() {
    this.client();
    if (!this.config.get<string>('STRIPE_WEBHOOK_SECRET'))
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
  }
  create(payment: Payment) {
    return this.client().paymentIntents.create(
      {
        amount: payment.amount.mul(100).toNumber(),
        currency: 'brl',
        allowed_payment_method_types: ['card'],
        metadata: { paymentId: payment.id, orderId: payment.orderId },
      },
      { idempotencyKey: `payment:${payment.id}` },
    );
  }
  retrieve(id: string) {
    return this.client().paymentIntents.retrieve(id);
  }
  cancel(id: string) {
    return this.client().paymentIntents.cancel(
      id,
      {},
      { idempotencyKey: `cancel:${id}` },
    );
  }
  getRefund(id: string) {
    return this.client().refunds.retrieve(id);
  }
  refund(id: string) {
    return this.client().refunds.create(
      { payment_intent: id },
      { idempotencyKey: `refund:${id}` },
    );
  }
  verify(body: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret)
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
    if (!body || !signature)
      throw new BadRequestException('Missing Stripe signature or raw body');
    try {
      return this.client().webhooks.constructEvent(body, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
  }
}
