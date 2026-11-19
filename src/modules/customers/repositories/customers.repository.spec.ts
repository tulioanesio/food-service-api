import { PrismaService } from 'src/prisma/prisma.service';
import { CustomersRepository } from './customers.repository';

describe('CustomersRepository', () => {
  const customerDelegate = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const db = {
    customer: customerDelegate,
    $transaction: jest.fn(),
  };
  const repository = new CustomersRepository(db as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a customer with explicit select', async () => {
    const data = { name: 'João', cpf: '12345678901', phone: null };
    const created = { id: 'c1', ...data, createdAt: new Date() };
    customerDelegate.create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(customerDelegate.create).toHaveBeenCalledWith({
      data,
      select: { id: true, name: true, cpf: true, phone: true, createdAt: true },
    });
  });

  it('gets a customer by id', async () => {
    const found = { id: 'c1', name: 'João' };
    customerDelegate.findUnique.mockResolvedValue(found);

    await expect(repository.get('c1')).resolves.toEqual(found);
    expect(customerDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: { id: true, name: true, cpf: true, phone: true, createdAt: true },
    });
  });

  it('updates a customer by id', async () => {
    const updated = { id: 'c1', name: 'João Pedro' };
    customerDelegate.update.mockResolvedValue(updated);

    await expect(
      repository.update('c1', { name: 'João Pedro' }),
    ).resolves.toEqual(updated);
    expect(customerDelegate.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'João Pedro' },
      select: { id: true, name: true, cpf: true, phone: true, createdAt: true },
    });
  });

  it('lists customers inside a RepeatableRead transaction', async () => {
    const where = { name: { contains: 'João' } };
    const findManyResult = [{ id: 'c1', name: 'João' }];
    customerDelegate.findMany.mockReturnValue('findManyOp');
    customerDelegate.count.mockReturnValue('countOp');
    db.$transaction.mockResolvedValue([findManyResult, 1]);

    await expect(repository.list(where, 2, 10)).resolves.toEqual([
      findManyResult,
      1,
    ]);
    expect(customerDelegate.findMany).toHaveBeenCalledWith({
      where,
      select: { id: true, name: true, cpf: true, phone: true, createdAt: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    });
    expect(customerDelegate.count).toHaveBeenCalledWith({ where });
    expect(db.$transaction).toHaveBeenCalledWith(['findManyOp', 'countOp'], {
      isolationLevel: 'RepeatableRead',
    });
  });
});
