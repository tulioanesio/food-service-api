import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
export function normalizeCpf(value: unknown): unknown {
  return typeof value === 'string' && /^[\d.\-\s]+$/.test(value)
    ? value.replace(/[.\-\s]/g, '')
    : value;
}
export function validCpf(value: unknown): boolean {
  if (
    typeof value !== 'string' ||
    !/^\d{11}$/.test(value) ||
    /^(\d)\1{10}$/.test(value)
  )
    return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(value[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(value[size])) return false;
  }
  return true;
}
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const formatted = value.trim();
  if (!/^\+?[\d()\s.-]+$/.test(formatted)) return value;
  const digits = formatted.replace(/\D/g, '');
  if (formatted.startsWith('+'))
    return digits.startsWith('55') ? digits.slice(2) : value;
  return digits;
}
export class CreateCustomerDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'CPF válido; persistido com 11 dígitos, sem pontuação. null significa ausência.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeCpf(value))
  @ValidateBy({
    name: 'cpf',
    validator: {
      validate: validCpf,
      defaultMessage: () => 'cpf must be a valid Brazilian CPF',
    },
  })
  cpf?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'DDD + telefone (10/11 dígitos). Aceita +55 explícito; persistido sem código do país. null limpa o valor.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizePhone(value))
  @ValidateBy({
    name: 'phone',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && /^[1-9]{2}\d{8,9}$/.test(value),
      defaultMessage: () =>
        'phone must contain a Brazilian area code and 10 or 11 national digits',
    },
  })
  phone?: string | null;
}
export class UpdateCustomerDto extends PartialType(CreateCustomerDto, {
  skipNullProperties: false,
}) {}
export class ListCustomersDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Busca por nome, CPF ou telefone; aceita pontuação numérica e +55.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
