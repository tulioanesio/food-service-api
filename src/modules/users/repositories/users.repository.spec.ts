import { UserRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { publicUserSelect } from './user.select';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  const userDelegate = {
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  };
  const repository = new UsersRepository({
    user: userDelegate,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('counts non-deleted users', async () => {
    userDelegate.count.mockResolvedValue(5);

    await expect(repository.countActive()).resolves.toBe(5);
    expect(userDelegate.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it('counts active administrators', async () => {
    userDelegate.count.mockResolvedValue(2);

    await expect(repository.countActiveAdministrators()).resolves.toBe(2);
    expect(userDelegate.count).toHaveBeenCalledWith({
      where: { role: UserRole.ADMIN, isActive: true, deletedAt: null },
    });
  });

  it('finds user by login or optional email', async () => {
    userDelegate.findFirst.mockResolvedValue({ id: 'u1' });

    await repository.findByLoginOrEmail('admin');
    expect(userDelegate.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ login: 'admin' }] },
    });

    await repository.findByLoginOrEmail('admin', 'admin@example.com');
    expect(userDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ login: 'admin' }, { email: 'admin@example.com' }],
      },
    });
  });

  it('creates a user with publicUserSelect', async () => {
    const data = {
      name: 'User',
      login: 'user',
      email: 'u@example.com',
      passwordHash: 'hash',
      role: UserRole.ATTENDANT,
    };
    userDelegate.create.mockResolvedValue({ id: 'u1' });

    await expect(repository.create(data)).resolves.toEqual({ id: 'u1' });
    expect(userDelegate.create).toHaveBeenCalledWith({
      data,
      select: publicUserSelect,
    });
  });

  it('finds active user by id with public select', async () => {
    userDelegate.findFirst.mockResolvedValue({ id: 'u1' });

    await expect(repository.findActiveById('u1')).resolves.toEqual({
      id: 'u1',
    });
    expect(userDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', isActive: true, deletedAt: null },
      select: publicUserSelect,
    });
  });

  it('finds active user by id with credentials', async () => {
    userDelegate.findFirst.mockResolvedValue({ id: 'u1', passwordHash: 'h' });

    await expect(
      repository.findActiveByIdWithCredentials('u1'),
    ).resolves.toEqual({ id: 'u1', passwordHash: 'h' });
    expect(userDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', isActive: true, deletedAt: null },
    });
  });

  it('finds all active users ordered by name', async () => {
    userDelegate.findMany.mockResolvedValue([{ id: 'u1' }]);

    await expect(repository.findAllActive()).resolves.toEqual([{ id: 'u1' }]);
    expect(userDelegate.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: publicUserSelect,
    });
  });

  it('updates a user by id', async () => {
    userDelegate.update.mockResolvedValue({ id: 'u1', name: 'New' });

    await expect(repository.update('u1', { name: 'New' })).resolves.toEqual({
      id: 'u1',
      name: 'New',
    });
    expect(userDelegate.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'New' },
      select: publicUserSelect,
    });
  });

  it('deactivates a user by id', async () => {
    userDelegate.update.mockResolvedValue({ id: 'u1', isActive: false });

    await expect(repository.deactivate('u1')).resolves.toEqual({
      id: 'u1',
      isActive: false,
    });
    expect(userDelegate.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false, deletedAt: expect.any(Date) as Date },
      select: publicUserSelect,
    });
  });

  it('purges deleted users before cutoff date', async () => {
    const cutoff = new Date('2026-01-01T00:00:00Z');
    userDelegate.deleteMany.mockResolvedValue({ count: 2 });

    await expect(repository.purgeDeletedBefore(cutoff)).resolves.toEqual({
      count: 2,
    });
    expect(userDelegate.deleteMany).toHaveBeenCalledWith({
      where: { deletedAt: { lte: cutoff } },
    });
  });
});
