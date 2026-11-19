import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, Prisma } from 'src/generated/prisma/client';
import Stripe from 'stripe';
import { StripeGateway } from './stripe.gateway';
import { envSchema } from 'src/config/env.validation';

describe('Stripe test-mode boundary', () => {
  const secret = 'whsec_local_test';
  const gateway = new StripeGateway(
    new ConfigService({
      STRIPE_SECRET_KEY: 'sk_test_local',
      STRIPE_WEBHOOK_SECRET: secret,
    }),
  );
  it('rejects live keys at configuration and gateway boundaries', () => {
    expect(
      envSchema.safeParse({
        DATABASE_URL: 'postgresql://localhost/test',
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_live_invalid',
      }).success,
    ).toBe(false);
    const live = new StripeGateway(
      new ConfigService({ STRIPE_SECRET_KEY: 'sk_live_invalid' }),
    );
    expect(() => live.assertConfigured()).toThrow(ServiceUnavailableException);
  });
  it('requires both secrets before reserving a card payment', () => {
    expect(() =>
      new StripeGateway(
        new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_local' }),
      ).assertConfigured(),
    ).toThrow(ServiceUnavailableException);
  });
  it('verifies the original bytes and rejects changed bodies, missing and expired signatures', () => {
    const stripe = new Stripe('sk_test_local');
    const payload = JSON.stringify({
      id: 'evt_test',
      type: 'payment_intent.succeeded',
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    expect(gateway.verify(Buffer.from(payload), signature).id).toBe('evt_test');
    expect(() => gateway.verify(Buffer.from(payload + ' '), signature)).toThrow(
      BadRequestException,
    );
    expect(() => gateway.verify(undefined, signature)).toThrow(
      BadRequestException,
    );
    expect(() => gateway.verify(Buffer.from(payload), undefined)).toThrow(
      BadRequestException,
    );
    const expired = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: 1,
    });
    expect(() => gateway.verify(Buffer.from(payload), expired)).toThrow(
      BadRequestException,
    );
  });

  it('throws ServiceUnavailableException in verify when webhook secret is missing', () => {
    const noWebhook = new StripeGateway(
      new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_local' }),
    );
    expect(() => noWebhook.verify(Buffer.from('{}'), 'sig')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('delegates paymentIntent and refund operations to Stripe client with idempotency keys', async () => {
    const client = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: 'pi_1' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'pi_1' }),
        cancel: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'canceled' }),
      },
      refunds: {
        retrieve: jest.fn().mockResolvedValue({ id: 're_1' }),
        create: jest.fn().mockResolvedValue({ id: 're_1' }),
      },
    };
    jest
      .spyOn(gateway as unknown as { client: () => typeof client }, 'client')
      .mockReturnValue(client);

    const payment = {
      id: 'pay_1',
      orderId: 'ord_1',
      amount: new Prisma.Decimal('25.50'),
    } as unknown as Payment;

    await expect(gateway.create(payment)).resolves.toEqual({ id: 'pi_1' });
    expect(client.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 2550,
        currency: 'brl',
        allowed_payment_method_types: ['card'],
        metadata: { paymentId: 'pay_1', orderId: 'ord_1' },
      },
      { idempotencyKey: 'payment:pay_1' },
    );

    await expect(gateway.retrieve('pi_1')).resolves.toEqual({ id: 'pi_1' });
    expect(client.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1');

    await expect(gateway.cancel('pi_1')).resolves.toEqual({
      id: 'pi_1',
      status: 'canceled',
    });
    expect(client.paymentIntents.cancel).toHaveBeenCalledWith(
      'pi_1',
      {},
      { idempotencyKey: 'cancel:pi_1' },
    );

    await expect(gateway.getRefund('re_1')).resolves.toEqual({ id: 're_1' });
    expect(client.refunds.retrieve).toHaveBeenCalledWith('re_1');

    await expect(gateway.refund('pi_1')).resolves.toEqual({ id: 're_1' });
    expect(client.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1' },
      { idempotencyKey: 'refund:pi_1' },
    );
  });
});
