import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StockController } from './stock.controller';
import { StockRepository } from './repositories/stock.repository';
import {
  GetStockUseCase,
  ListStockUseCase,
  MoveStockUseCase,
  StockHistoryUseCase,
  UpdateStockMinimumUseCase,
} from './use-cases/stock.use-cases';
@Module({
  imports: [PrismaModule],
  controllers: [StockController],
  providers: [
    StockRepository,
    GetStockUseCase,
    ListStockUseCase,
    MoveStockUseCase,
    StockHistoryUseCase,
    UpdateStockMinimumUseCase,
  ],
})
export class StockModule {}
