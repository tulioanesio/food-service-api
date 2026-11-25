import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class CreateProductUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute(dto: CreateProductDto) {
    if (
      dto.initialStock !== undefined &&
      (!Number.isInteger(dto.initialStock) ||
        dto.initialStock < 0 ||
        dto.initialStock > 1000000)
    ) {
      throw new BadRequestException(
        'Initial stock must be a non-negative integer',
      );
    }

    if (
      dto.minimumStock !== undefined &&
      (!Number.isInteger(dto.minimumStock) ||
        dto.minimumStock < 0 ||
        dto.minimumStock > 1000000)
    ) {
      throw new BadRequestException(
        'Minimum stock must be a non-negative integer',
      );
    }

    const existingProduct = await this.productsRepository.findByNameAndCategory(
      dto.name,
      dto.category,
    );

    if (existingProduct) {
      throw new ConflictException(
        'A product with this name and category already exists',
      );
    }

    return this.productsRepository.create(dto);
  }
}
