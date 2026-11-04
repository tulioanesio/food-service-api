import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
