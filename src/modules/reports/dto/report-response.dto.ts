import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from 'src/common/dto/pagination.dto';
export class PeriodResponseDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Limite incluído, normalizado em UTC.',
  })
  from: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Limite excluído, normalizado em UTC.',
  })
  to: string;
}
export class OrderSummaryDto {
  @ApiProperty() count: number;
  @ApiProperty({ example: '100.00' }) total: string;
  @ApiProperty({
    example: '33.33',
    description: 'Arredondamento HALF_UP a duas casas.',
  })
  averageTicket: string;
}
export class ReceiptSummaryDto {
  @ApiProperty({
    enum: ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'MEAL_VOUCHER'],
  })
  method: string;
  @ApiProperty() count: number;
  @ApiProperty({
    example: '100.00',
    description: 'Soma de Payment.amount; exclui troco e receivedAmount.',
  })
  amount: string;
}
export class SalesReportResponseDto {
  @ApiProperty({ type: PeriodResponseDto }) period: PeriodResponseDto;
  @ApiProperty({ type: OrderSummaryDto }) orders: OrderSummaryDto;
  @ApiProperty({ type: [ReceiptSummaryDto] })
  receiptsByMethod: ReceiptSummaryDto[];
}
export class ProductSalesDto {
  @ApiProperty({ format: 'uuid' }) productId: string;
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiProperty() quantitySold: number;
  @ApiProperty({ example: '100.00' }) totalSold: string;
}
export class ProductsReportResponseDto {
  @ApiProperty({ type: PeriodResponseDto }) period: PeriodResponseDto;
  @ApiProperty({ type: [ProductSalesDto] }) data: ProductSalesDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
export class ProductStockDto {
  @ApiProperty({ format: 'uuid' }) productId: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() currentQuantity: number;
  @ApiProperty() minimumQuantity: number;
  @ApiProperty() lowStock: boolean;
  @ApiProperty() entries: number;
  @ApiProperty() exits: number;
  @ApiProperty() losses: number;
  @ApiProperty() positiveAdjustments: number;
  @ApiProperty() negativeAdjustments: number;
  @ApiProperty() netMovement: number;
}
export class StockReportResponseDto {
  @ApiProperty({ type: PeriodResponseDto }) period: PeriodResponseDto;
  @ApiProperty({
    format: 'date-time',
    description: 'Snapshot da consulta, não o limite to.',
  })
  asOf: string;
  @ApiProperty({ type: [ProductStockDto] }) data: ProductStockDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
