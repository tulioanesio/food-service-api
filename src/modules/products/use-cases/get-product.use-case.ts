import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class GetProductUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async execute(id: string) {
    const product = await this.productsRepository.findActiveById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
