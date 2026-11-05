import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, ValidateIf, IsString, IsUUID, Matches } from 'class-validator';
import { PaymentMethod } from 'src/generated/prisma/client';
export class CreatePaymentDto {
  @ApiProperty() @IsUUID() idempotencyKey: string;
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
  @ApiProperty({
    example: '12.50',
    description: 'BRL decimal string, up to two decimal places',
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  amount: string;
  @ApiPropertyOptional({ example: '20.00' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  receivedAmount?: string;
}
