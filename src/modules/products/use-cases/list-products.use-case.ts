import { Injectable } from '@nestjs/common';
import { ListProductsDto } from '../dto/list-products.dto';
import { ProductsRepository } from '../repositories/products.repository';

@Injectable()
export class ListProductsUseCase {
  constructor(private readonly productsRepository: ProductsRepository) {}

  execute(filters: ListProductsDto) {
    return this.productsRepository.findAll(filters);
  }
}
