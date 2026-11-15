import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateBy } from 'class-validator';
import type { ValidationArguments } from 'class-validator';
export class PaginationDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: 2147483647,
    description:
      'Página inteira; o deslocamento (page - 1) × limit deve ser no máximo 2147483647.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  @ValidateBy({
    name: 'pageOffset',
    validator: {
      validate: (value: unknown, args?: ValidationArguments) => {
        const { limit } = args?.object as PaginationDto;
        return (
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          Number.isSafeInteger((value - 1) * limit) &&
          (value - 1) * limit <= 2147483647
        );
      },
      defaultMessage: () => 'pagination offset must not exceed 2147483647',
    },
  })
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export function pagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty({ description: 'Total de registros em todas as páginas.' })
  total: number;
  @ApiProperty() totalPages: number;
}
