import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import { IntersectionType } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
export class ReportPeriodDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Início incluído, ISO 8601 com Z ou offset explícito.',
  })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  from: string;
  @ApiProperty({
    format: 'date-time',
    description:
      'Fim excluído, posterior a from, ISO 8601 com Z ou offset explícito.',
  })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  to: string;
}
export class ProductsReportDto extends IntersectionType(
  ReportPeriodDto,
  PaginationDto,
) {}
export class StockReportDto extends ProductsReportDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description:
      'true: saldo < mínimo; false: saldo >= mínimo; omitido: todos.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string;
}
