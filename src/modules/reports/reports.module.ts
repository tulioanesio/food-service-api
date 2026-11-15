import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './repositories/reports.repository';
import {
  SalesReportUseCase,
  ProductsReportUseCase,
  StockReportUseCase,
} from './use-cases/reports.use-cases';
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [
    ReportsRepository,
    SalesReportUseCase,
    ProductsReportUseCase,
    StockReportUseCase,
  ],
})
export class ReportsModule {}
