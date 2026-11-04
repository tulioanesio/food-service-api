import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductUseCase } from './use-cases/create-product.use-case';
import { DeactivateProductUseCase } from './use-cases/deactivate-product.use-case';
import { GetProductUseCase } from './use-cases/get-product.use-case';
import { ListProductsUseCase } from './use-cases/list-products.use-case';
import { UpdateProductUseCase } from './use-cases/update-product.use-case';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deactivateProductUseCase: DeactivateProductUseCase,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.createProductUseCase.execute(dto);
  }

  @Get()
  findAll(@Query() filters: ListProductsDto) {
    return this.listProductsUseCase.execute(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getProductUseCase.execute(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.updateProductUseCase.execute(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deactivateProductUseCase.execute(id);
  }
}
