import { CustomersModule } from './modules/customers/customers.module';
import { StockModule } from './modules/stock/stock.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { envSchema } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = envSchema.safeParse(config);

        if (!result.success) {
          console.error('Error validating environment variables:');
          console.error(result.error.format());
          throw new Error('Invalid environment configuration');
        }

        return result.data;
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    StockModule,
    OrdersModule,
    PaymentsModule,
    HealthModule,
    CustomersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  controllers: [],
})
export class AppModule {}
