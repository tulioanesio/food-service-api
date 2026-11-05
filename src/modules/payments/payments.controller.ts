import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReasonDto } from '../orders/dto/order.dto';
import { CreatePaymentDto } from './dto/payment.dto';
import {
  CreatePaymentUseCase,
  ReversePaymentUseCase,
  StripeWebhookUseCase,
} from './use-cases/payments.use-cases';
@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly createPayment: CreatePaymentUseCase,
    private readonly reversePayment: ReversePaymentUseCase,
    private readonly webhook: StripeWebhookUseCase,
  ) {}
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @Post('orders/:id/payments')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createPayment.execute(id, dto, user.id);
  }
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('payments/:id/reverse')
  reverse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.reversePayment.execute(id, dto.reason);
  }
  @Public()
  @SkipThrottle()
  @Post('payments/stripe/webhook')
  @HttpCode(200)
  @ApiHeader({ name: 'stripe-signature', required: true })
  handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.webhook.execute(request.rawBody, signature);
  }
}
