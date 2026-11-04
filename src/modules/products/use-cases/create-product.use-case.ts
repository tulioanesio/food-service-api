import { ConflictException, Injectable } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class CreateProductUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute(dto: CreateProductDto) {
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
