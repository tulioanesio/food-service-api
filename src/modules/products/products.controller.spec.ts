import { ProductsController } from './products.controller';
import { CreateProductUseCase } from './use-cases/create-product.use-case';
import { DeactivateProductUseCase } from './use-cases/deactivate-product.use-case';
import { GetProductUseCase } from './use-cases/get-product.use-case';
import { ListProductsUseCase } from './use-cases/list-products.use-case';
import { UpdateProductUseCase } from './use-cases/update-product.use-case';

describe('ProductsController', () => {
  const createProductUseCase = { execute: jest.fn() };
  const listProductsUseCase = { execute: jest.fn() };
  const getProductUseCase = { execute: jest.fn() };
  const updateProductUseCase = { execute: jest.fn() };
  const deactivateProductUseCase = { execute: jest.fn() };

  const controller = new ProductsController(
    createProductUseCase as unknown as CreateProductUseCase,
    listProductsUseCase as unknown as ListProductsUseCase,
    getProductUseCase as unknown as GetProductUseCase,
    updateProductUseCase as unknown as UpdateProductUseCase,
    deactivateProductUseCase as unknown as DeactivateProductUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates create to CreateProductUseCase', async () => {
    const dto = { name: 'Burger', category: 'Lanches', price: 25 };
    createProductUseCase.execute.mockResolvedValue({ id: 'p1', ...dto });

    await expect(controller.create(dto)).resolves.toEqual({ id: 'p1', ...dto });
    expect(createProductUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to ListProductsUseCase', async () => {
    const filters = { search: 'Burger', category: 'Lanches' };
    listProductsUseCase.execute.mockResolvedValue([{ id: 'p1' }]);

    await expect(controller.findAll(filters)).resolves.toEqual([{ id: 'p1' }]);
    expect(listProductsUseCase.execute).toHaveBeenCalledWith(filters);
  });

  it('delegates findOne to GetProductUseCase', async () => {
    getProductUseCase.execute.mockResolvedValue({ id: 'p1' });

    await expect(controller.findOne('p1')).resolves.toEqual({ id: 'p1' });
    expect(getProductUseCase.execute).toHaveBeenCalledWith('p1');
  });

  it('delegates update to UpdateProductUseCase', async () => {
    const dto = { price: 30 };
    updateProductUseCase.execute.mockResolvedValue({ id: 'p1', price: 30 });

    await expect(controller.update('p1', dto)).resolves.toEqual({
      id: 'p1',
      price: 30,
    });
    expect(updateProductUseCase.execute).toHaveBeenCalledWith('p1', dto);
  });

  it('delegates remove to DeactivateProductUseCase', async () => {
    deactivateProductUseCase.execute.mockResolvedValue({
      id: 'p1',
      isActive: false,
    });

    await expect(controller.remove('p1')).resolves.toEqual({
      id: 'p1',
      isActive: false,
    });
    expect(deactivateProductUseCase.execute).toHaveBeenCalledWith('p1');
  });
});
