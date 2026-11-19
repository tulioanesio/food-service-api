import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { CreateUserUseCase } from './use-cases/create-user.use-case';
import { DeactivateUserUseCase } from './use-cases/deactivate-user.use-case';
import { GetUserUseCase } from './use-cases/get-user.use-case';
import { ListUsersUseCase } from './use-cases/list-users.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const createUserUseCase = { execute: jest.fn() };
  const listUsersUseCase = { execute: jest.fn() };
  const getUserUseCase = { execute: jest.fn() };
  const updateUserUseCase = { execute: jest.fn() };
  const deactivateUserUseCase = { execute: jest.fn() };

  const controller = new UsersController(
    createUserUseCase as unknown as CreateUserUseCase,
    listUsersUseCase as unknown as ListUsersUseCase,
    getUserUseCase as unknown as GetUserUseCase,
    updateUserUseCase as unknown as UpdateUserUseCase,
    deactivateUserUseCase as unknown as DeactivateUserUseCase,
  );

  const actor: AuthenticatedUser = {
    id: 'u1',
    login: 'admin',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates create to CreateUserUseCase', async () => {
    const dto = {
      name: 'User',
      login: 'user',
      password: 'password123',
      role: UserRole.ATTENDANT,
    };
    createUserUseCase.execute.mockResolvedValue({ id: 'u2' });

    await expect(controller.create(dto, actor)).resolves.toEqual({ id: 'u2' });
    expect(createUserUseCase.execute).toHaveBeenCalledWith(dto, actor);
  });

  it('delegates findAll to ListUsersUseCase', async () => {
    listUsersUseCase.execute.mockResolvedValue([{ id: 'u1' }]);

    await expect(controller.findAll()).resolves.toEqual([{ id: 'u1' }]);
    expect(listUsersUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('delegates findOne to GetUserUseCase', async () => {
    getUserUseCase.execute.mockResolvedValue({ id: 'u1' });

    await expect(controller.findOne('u1', actor)).resolves.toEqual({
      id: 'u1',
    });
    expect(getUserUseCase.execute).toHaveBeenCalledWith('u1', actor);
  });

  it('delegates update to UpdateUserUseCase', async () => {
    const dto = { name: 'Updated' };
    updateUserUseCase.execute.mockResolvedValue({ id: 'u1', name: 'Updated' });

    await expect(controller.update('u1', dto, actor)).resolves.toEqual({
      id: 'u1',
      name: 'Updated',
    });
    expect(updateUserUseCase.execute).toHaveBeenCalledWith('u1', dto, actor);
  });

  it('delegates remove to DeactivateUserUseCase', async () => {
    deactivateUserUseCase.execute.mockResolvedValue({
      id: 'u1',
      isActive: false,
    });

    await expect(controller.remove('u1', actor)).resolves.toEqual({
      id: 'u1',
      isActive: false,
    });
    expect(deactivateUserUseCase.execute).toHaveBeenCalledWith('u1', actor);
  });
});
