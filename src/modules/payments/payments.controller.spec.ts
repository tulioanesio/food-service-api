import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsController } from './payments.controller';
import {
  CreatePaymentUseCase,
  ReversePaymentUseCase,
  StripeWebhookUseCase,
} from './use-cases/payments.use-cases';

describe('PaymentsController', () => {
  const createPayment = { execute: jest.fn() };
  const reversePayment = { execute: jest.fn() };
  const webhook = { execute: jest.fn() };

  const controller = new PaymentsController(
    createPayment as unknown as CreatePaymentUseCase,
    reversePayment as unknown as ReversePaymentUseCase,
    webhook as unknown as StripeWebhookUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates create to CreatePaymentUseCase', async () => {
    const dto = {
      method: 'CASH' as const,
      amount: '10.00',
      receivedAmount: '10.00',
      idempotencyKey: 'k1',
    };
    const user: AuthenticatedUser = {
      id: 'u1',
      login: 'cashier',
      role: UserRole.CASHIER,
    };
    createPayment.execute.mockResolvedValue({ payment: { id: 'p1' } });

    await expect(controller.create('o1', dto, user)).resolves.toEqual({
      payment: { id: 'p1' },
    });
    expect(createPayment.execute).toHaveBeenCalledWith('o1', dto, 'u1');
  });

  it('delegates reverse to ReversePaymentUseCase', async () => {
    reversePayment.execute.mockResolvedValue({ id: 'p1', status: 'REFUNDED' });

    await expect(
      controller.reverse('p1', { reason: 'Customer cancelled' }),
    ).resolves.toEqual({ id: 'p1', status: 'REFUNDED' });
    expect(reversePayment.execute).toHaveBeenCalledWith(
      'p1',
      'Customer cancelled',
    );
  });

  it('delegates handleWebhook to StripeWebhookUseCase', async () => {
    const rawBody = Buffer.from('{}');
    const req = { rawBody } as unknown as RawBodyRequest<Request>;
    webhook.execute.mockResolvedValue({ received: true });

    await expect(controller.handleWebhook(req, 'sig_123')).resolves.toEqual({
      received: true,
    });
    expect(webhook.execute).toHaveBeenCalledWith(rawBody, 'sig_123');
  });
});
