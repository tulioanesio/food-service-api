import { ForbiddenException } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserUseCase } from './create-user.use-case';
import { DeactivateUserUseCase } from './deactivate-user.use-case';
import { UpdateUserUseCase } from './update-user.use-case';

describe('User use cases', () => {
  type CreateUserInput = Parameters<UsersRepository['create']>[0];

  const countActiveMock = jest.fn<() => Promise<number>>();
  const countActiveAdministratorsMock = jest.fn<() => Promise<number>>();
  const findByLoginOrEmailMock = jest.fn<() => Promise<null>>();
  const createMock =
    jest.fn<(data: CreateUserInput) => Promise<{ id: string }>>();
  const findActiveByIdMock = jest.fn();
  const findActiveByIdWithCredentialsMock = jest.fn();
  const findAllActiveMock = jest.fn();
  const updateMock = jest.fn();
  const deactivateMock = jest.fn();
  const purgeDeletedBeforeMock = jest.fn();

  const usersRepository = {
    countActive: countActiveMock,
    countActiveAdministrators: countActiveAdministratorsMock,
    findByLoginOrEmail: findByLoginOrEmailMock,
    create: createMock,
    findActiveById: findActiveByIdMock,
    findActiveByIdWithCredentials: findActiveByIdWithCredentialsMock,
    findAllActive: findAllActiveMock,
    update: updateMock,
    deactivate: deactivateMock,
    purgeDeletedBefore: purgeDeletedBeforeMock,
  } as unknown as UsersRepository;

  const firstUserDto: CreateUserDto = {
    name: 'Admin User',
    login: 'admin',
    email: 'admin@example.com',
    password: 'strong-password',
    role: UserRole.ADMIN,
  };

  const actor: AuthenticatedUser = {
    id: 'user-id',
    login: 'user',
    role: UserRole.ATTENDANT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the first user and hashes the password', async () => {
    countActiveMock.mockResolvedValue(0);
    findByLoginOrEmailMock.mockResolvedValue(null);
    const createInputs: CreateUserInput[] = [];
    const createImplementation = (
      data: CreateUserInput,
    ): Promise<{ id: string }> => {
      createInputs.push(data);
      return Promise.resolve({ id: 'user-id' });
    };
    createMock.mockImplementation(createImplementation);

    await new CreateUserUseCase(usersRepository).execute(firstUserDto);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.ADMIN,
      }),
    );
    const createCall = createInputs[0];
    expect(createCall.passwordHash).not.toBe(firstUserDto.password);
  });

  it('rejects user creation by a non-administrator after bootstrap', async () => {
    countActiveMock.mockResolvedValue(1);

    await expect(
      new CreateUserUseCase(usersRepository).execute(firstUserDto, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects editing another user profile', async () => {
    await expect(
      new UpdateUserUseCase(usersRepository).execute(
        'another-user-id',
        { name: 'Changed' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows an administrator to deactivate another user', async () => {
    const administrator: AuthenticatedUser = {
      id: 'admin-id',
      login: 'admin',
      role: UserRole.ADMIN,
    };
    findActiveByIdWithCredentialsMock.mockResolvedValue({
      id: 'user-id',
      role: UserRole.ATTENDANT,
    });
    deactivateMock.mockResolvedValue({
      id: 'user-id',
      isActive: false,
    });

    await new DeactivateUserUseCase(usersRepository).execute(
      'user-id',
      administrator,
    );

    expect(deactivateMock).toHaveBeenCalledWith('user-id');
  });

  it('does not deactivate the last active administrator', async () => {
    const administrator: AuthenticatedUser = {
      id: 'admin-id',
      login: 'admin',
      role: UserRole.ADMIN,
    };
    findActiveByIdWithCredentialsMock.mockResolvedValue({
      id: 'admin-id',
      role: UserRole.ADMIN,
    });
    countActiveAdministratorsMock.mockResolvedValue(1);

    await expect(
      new DeactivateUserUseCase(usersRepository).execute(
        'admin-id',
        administrator,
      ),
    ).rejects.toThrow('The last administrator cannot be deactivated');
    expect(deactivateMock).not.toHaveBeenCalled();
  });
});
