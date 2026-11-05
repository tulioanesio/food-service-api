import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { StripeGateway } from './stripe.gateway';
import {
  CreatePaymentUseCase,
  ReversePaymentUseCase,
  StripeWebhookUseCase,
} from './use-cases/payments.use-cases';
@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [
    StripeGateway,
    CreatePaymentUseCase,
    ReversePaymentUseCase,
    StripeWebhookUseCase,
  ],
})
export class PaymentsModule {}
