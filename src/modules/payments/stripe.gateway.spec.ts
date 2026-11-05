import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
});
