import { PaginationMetaDto } from 'src/common/dto/pagination.dto';
import { ApiProperty } from '@nestjs/swagger';
export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, description: 'CPF sem pontuação.' }) cpf:
    | string
    | null;
  @ApiProperty({
    nullable: true,
    description: 'Telefone nacional com DDD, sem +55.',
  })
  phone: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
export class CustomerListResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] }) data: CustomerResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
