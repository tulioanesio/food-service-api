import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './repositories/products.repository';
import { CreateProductUseCase } from './use-cases/create-product.use-case';
import { DeactivateProductUseCase } from './use-cases/deactivate-product.use-case';
import { GetProductUseCase } from './use-cases/get-product.use-case';
import { ListProductsUseCase } from './use-cases/list-products.use-case';
import { UpdateProductUseCase } from './use-cases/update-product.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [
    ProductsRepository,
    CreateProductUseCase,
    ListProductsUseCase,
    GetProductUseCase,
    UpdateProductUseCase,
    DeactivateProductUseCase,
  ],
  exports: [ProductsRepository],
})
export class ProductsModule {}
