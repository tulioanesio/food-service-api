import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository';
import { CreateProductUseCase } from './create-product.use-case';
import { DeactivateProductUseCase } from './deactivate-product.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { UpdateProductUseCase } from './update-product.use-case';

describe('Product use cases', () => {
  const findByNameAndCategoryMock = jest.fn();
  const createMock = jest.fn();
  const findActiveByIdMock = jest.fn();
  const updateMock = jest.fn();
  const deactivateMock = jest.fn();
  const productsRepository = {
    findByNameAndCategory: findByNameAndCategoryMock,
    create: createMock,
    findAll: jest.fn(),
    findActiveById: findActiveByIdMock,
    update: updateMock,
    deactivate: deactivateMock,
  } as unknown as ProductsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a product when the name and category are unique', async () => {
    findByNameAndCategoryMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'product-id' });

    await new CreateProductUseCase(productsRepository).execute({
      name: 'Classic Burger',
      category: 'Burgers',
      price: 25.9,
    });

    expect(createMock).toHaveBeenCalled();
  });

  it('rejects duplicate products', async () => {
    findByNameAndCategoryMock.mockResolvedValue({ id: 'existing-id' });

    await expect(
      new CreateProductUseCase(productsRepository).execute({
        name: 'Classic Burger',
        category: 'Burgers',
        price: 25.9,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects access to an inactive product', async () => {
    findActiveByIdMock.mockResolvedValue(null);

    await expect(
      new GetProductUseCase(productsRepository).execute('product-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes an active product', async () => {
    findActiveByIdMock.mockResolvedValue({ id: 'product-id' });
    deactivateMock.mockResolvedValue({ id: 'product-id', isActive: false });

    await new DeactivateProductUseCase(productsRepository).execute(
      'product-id',
    );

    expect(deactivateMock).toHaveBeenCalledWith('product-id');
  });

  it('rejects an update that duplicates another product', async () => {
    findActiveByIdMock.mockResolvedValue({
      id: 'product-id',
      name: 'Classic Burger',
      category: 'Burgers',
    });
    findByNameAndCategoryMock.mockResolvedValue({ id: 'other-product-id' });

    await expect(
      new UpdateProductUseCase(productsRepository).execute('product-id', {
        name: 'Other Burger',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
