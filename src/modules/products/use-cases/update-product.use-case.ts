import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class UpdateProductUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute(id: string, dto: UpdateProductDto) {
    const product = await this.productsRepository.findActiveById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const name = dto.name ?? product.name;
    const category = dto.category ?? product.category;
    const duplicate = await this.productsRepository.findByNameAndCategory(
      name,
      category,
    );

    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'A product with this name and category already exists',
      );
    }

    return this.productsRepository.update(id, dto);
  }
}
