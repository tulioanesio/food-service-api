import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './repositories/customers.repository';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './use-cases/customers.use-cases';
@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [
    CustomersRepository,
    CreateCustomerUseCase,
    GetCustomerUseCase,
    ListCustomersUseCase,
    UpdateCustomerUseCase,
  ],
})
export class CustomersModule {}
