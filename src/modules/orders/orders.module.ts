import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './repositories/orders.repository';
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  TransitionOrderUseCase,
} from './use-cases/orders.use-cases';
@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [
    OrdersRepository,
    CreateOrderUseCase,
    GetOrderUseCase,
    ListOrdersUseCase,
    TransitionOrderUseCase,
  ],
  exports: [OrdersRepository],
})
export class OrdersModule {}
