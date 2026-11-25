import { PrismaService } from 'src/prisma/prisma.service';
import { publicProductSelect } from './product.select';
import { ProductsRepository } from './products.repository';

describe('ProductsRepository', () => {
  const productDelegate = {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  const repository = new ProductsRepository({
    product: productDelegate,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('finds product by name and category case-insensitively', async () => {
    productDelegate.findFirst.mockResolvedValue({ id: 'p1' });

    await expect(
      repository.findByNameAndCategory('Burger', 'Lanches'),
    ).resolves.toEqual({ id: 'p1' });
    expect(productDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: 'Burger', mode: 'insensitive' },
        category: { equals: 'Lanches', mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('creates a product with initial empty stock record', async () => {
    const data = { name: 'Burger', category: 'Lanches', price: 25 };
    productDelegate.create.mockResolvedValue({ id: 'p1', ...data });

    await expect(repository.create(data)).resolves.toEqual({
      id: 'p1',
      ...data,
    });
    expect(productDelegate.create).toHaveBeenCalledWith({
      data: {
        ...data,
        stock: {
          create: {
            totalQuantity: 0,
            inputQuantity: 0,
            minimumQuantity: 0,
          },
        },
      },
      select: publicProductSelect,
    });
  });

  it('creates a product with initial stock and movement when initialStock > 0', async () => {
    const data = {
      name: 'Burger',
      category: 'Lanches',
      price: 25,
      initialStock: 15,
      minimumStock: 5,
    };
    productDelegate.create.mockResolvedValue({ id: 'p1', ...data });

    await expect(repository.create(data)).resolves.toEqual({
      id: 'p1',
      ...data,
    });
    expect(productDelegate.create).toHaveBeenCalledWith({
      data: {
        name: 'Burger',
        category: 'Lanches',
        price: 25,
        stock: {
          create: {
            totalQuantity: 15,
            inputQuantity: 15,
            minimumQuantity: 5,
          },
        },
        stockMoves: {
          create: {
            type: 'ENTRY',
            quantity: 15,
            idempotencyKey: expect.any(String) as string,
            reason: 'Estoque inicial no cadastro do produto',
          },
        },
      },
      select: publicProductSelect,
    });
  });

  it('lists all active products with optional category and search filters', async () => {
    productDelegate.findMany.mockResolvedValue([{ id: 'p1' }]);

    await repository.findAll({});
    expect(productDelegate.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: publicProductSelect,
    });

    await repository.findAll({ category: 'Lanches', search: 'Bur' });
    expect(productDelegate.findMany).toHaveBeenLastCalledWith({
      where: {
        isActive: true,
        deletedAt: null,
        category: { equals: 'Lanches', mode: 'insensitive' },
        OR: [
          { name: { contains: 'Bur', mode: 'insensitive' } },
          { category: { contains: 'Bur', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: publicProductSelect,
    });
  });

  it('finds an active product by id', async () => {
    productDelegate.findFirst.mockResolvedValue({ id: 'p1' });

    await expect(repository.findActiveById('p1')).resolves.toEqual({
      id: 'p1',
    });
    expect(productDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', isActive: true, deletedAt: null },
      select: publicProductSelect,
    });
  });

  it('updates a product by id', async () => {
    productDelegate.update.mockResolvedValue({ id: 'p1', price: 30 });

    await expect(repository.update('p1', { price: 30 })).resolves.toEqual({
      id: 'p1',
      price: 30,
    });
    expect(productDelegate.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { price: 30 },
      select: publicProductSelect,
    });
  });

  it('deactivates a product by id', async () => {
    productDelegate.update.mockResolvedValue({ id: 'p1', isActive: false });

    await expect(repository.deactivate('p1')).resolves.toEqual({
      id: 'p1',
      isActive: false,
    });
    expect(productDelegate.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false, deletedAt: expect.any(Date) as Date },
      select: publicProductSelect,
    });
  });
});
