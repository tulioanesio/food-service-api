import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { StockMovementType } from 'src/generated/prisma/client';
export class CreateStockMovementDto {
  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type: StockMovementType;
  @ApiProperty({
    description:
      'Positive units for ENTRY/EXIT/LOSS; signed delta for ADJUSTMENT',
  })
  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  @NotEquals(0)
  quantity: number;
  @ApiProperty() @IsUUID() idempotencyKey: string;
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
export class UpdateStockMinimumDto {
  @ApiProperty() @IsInt() @Min(0) @Max(1000000) minimumQuantity: number;
}
export class ListStockDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string;
}
export class ListStockMovementsDto {
  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
