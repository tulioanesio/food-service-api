import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateOrderDto, ListOrdersDto, ReasonDto } from './dto/order.dto';
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  TransitionOrderUseCase,
} from './use-cases/orders.use-cases';
const sales = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.ATTENDANT,
];
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly listOrders: ListOrdersUseCase,
    private readonly transition: TransitionOrderUseCase,
  ) {}
  @Roles(...sales) @Post() create(@Body() dto: CreateOrderDto) {
    return this.createOrder.execute(dto);
  }
  @Roles(...sales, UserRole.KITCHEN) @Get() list(@Query() dto: ListOrdersDto) {
    return this.listOrders.execute(dto);
  }
  @Roles(...sales) @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOrder.execute(id);
  }
  @Roles(...sales) @Post(':id/confirm') confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transition.execute(id, 'CONFIRMED', user.id);
  }
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN)
  @Post(':id/prepare')
  prepare(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transition.execute(id, 'PREPARING', user.id);
  }
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN)
  @Post(':id/ready')
  ready(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transition.execute(id, 'READY', user.id);
  }
  @Roles(...sales) @Post(':id/complete') complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transition.execute(id, 'COMPLETED', user.id);
  }
  @Roles(UserRole.ADMIN, UserRole.MANAGER) @Post(':id/cancel') cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transition.execute(id, 'CANCELLED', user.id, dto.reason);
  }
}
