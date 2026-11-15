import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserUseCase } from './create-user.use-case';
import { DeactivateUserUseCase } from './deactivate-user.use-case';
import { GetUserUseCase } from './get-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { PurgeDeletedUsersUseCase } from './purge-deleted-users.use-case';
import { UpdateUserUseCase } from './update-user.use-case';

describe('User use cases', () => {
  type CreateUserInput = Parameters<UsersRepository['create']>[0];

  const countActiveMock = jest.fn<() => Promise<number>>();
  const countActiveAdministratorsMock = jest.fn<() => Promise<number>>();
  const findByLoginOrEmailMock = jest.fn<() => Promise<unknown>>();
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

  it('rejects unauthenticated user creation after bootstrap', async () => {
    countActiveMock.mockResolvedValue(1);

    await expect(
      new CreateUserUseCase(usersRepository).execute(firstUserDto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects duplicate login or email when creating user', async () => {
    countActiveMock.mockResolvedValue(0);
    findByLoginOrEmailMock.mockResolvedValue({ id: 'existing' });

    await expect(
      new CreateUserUseCase(usersRepository).execute({
        ...firstUserDto,
        role: undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('defaults role to ATTENDANT when role is omitted on create', async () => {
    countActiveMock.mockResolvedValue(0);
    findByLoginOrEmailMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'u2' });

    await new CreateUserUseCase(usersRepository).execute({
      name: 'Attendant',
      login: 'attendant',
      password: 'strong-password',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ATTENDANT }),
    );
  });

  it('lists all active users', async () => {
    findAllActiveMock.mockResolvedValue([{ id: 'u1' }]);

    await expect(
      new ListUsersUseCase(usersRepository).execute(),
    ).resolves.toEqual([{ id: 'u1' }]);
  });

  it('gets own user profile and allows ADMIN or MANAGER to view others', async () => {
    findActiveByIdMock.mockResolvedValue({ id: 'user-id' });
    await expect(
      new GetUserUseCase(usersRepository).execute('user-id', actor),
    ).resolves.toEqual({ id: 'user-id' });

    const manager: AuthenticatedUser = {
      id: 'mgr-id',
      login: 'mgr',
      role: UserRole.MANAGER,
    };
    await expect(
      new GetUserUseCase(usersRepository).execute('user-id', manager),
    ).resolves.toEqual({ id: 'user-id' });
  });

  it('rejects viewing another user profile for non-privileged roles and throws NotFoundException when missing', async () => {
    await expect(
      new GetUserUseCase(usersRepository).execute('other-id', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    findActiveByIdMock.mockResolvedValue(null);
    await expect(
      new GetUserUseCase(usersRepository).execute('user-id', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates own profile with and without password, handles NotFoundException, P2002 conflict, and rethrows other errors', async () => {
    findActiveByIdWithCredentialsMock.mockResolvedValue(null);
    await expect(
      new UpdateUserUseCase(usersRepository).execute(
        'user-id',
        { name: 'New' },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    findActiveByIdWithCredentialsMock.mockResolvedValue({ id: 'user-id' });
    updateMock.mockResolvedValue({ id: 'user-id', name: 'New' });

    await expect(
      new UpdateUserUseCase(usersRepository).execute(
        'user-id',
        { name: 'New', email: 'new@example.com', password: 'new-password' },
        actor,
      ),
    ).resolves.toEqual({ id: 'user-id', name: 'New' });
    expect(updateMock).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({
        name: 'New',
        email: 'new@example.com',
        passwordHash: expect.any(String) as string,
      }),
    );

    await new UpdateUserUseCase(usersRepository).execute(
      'user-id',
      { name: 'OnlyName' },
      actor,
    );
    expect(updateMock).toHaveBeenLastCalledWith('user-id', {
      name: 'OnlyName',
      email: undefined,
      passwordHash: undefined,
    });

    updateMock.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      new UpdateUserUseCase(usersRepository).execute(
        'user-id',
        { email: 'dup@example.com' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const genericError = new Error('db failure');
    updateMock.mockRejectedValueOnce(genericError);
    await expect(
      new UpdateUserUseCase(usersRepository).execute(
        'user-id',
        { name: 'Fail' },
        actor,
      ),
    ).rejects.toThrow(genericError);
  });

  it('rejects non-admin deactivating another user, handles missing user, and allows deactivating non-last admin', async () => {
    await expect(
      new DeactivateUserUseCase(usersRepository).execute('other-id', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    findActiveByIdWithCredentialsMock.mockResolvedValue(null);
    await expect(
      new DeactivateUserUseCase(usersRepository).execute('user-id', actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    const administrator: AuthenticatedUser = {
      id: 'admin-id',
      login: 'admin',
      role: UserRole.ADMIN,
    };
    findActiveByIdWithCredentialsMock.mockResolvedValue({
      id: 'admin-id',
      role: UserRole.ADMIN,
    });
    countActiveAdministratorsMock.mockResolvedValue(2);
    deactivateMock.mockResolvedValue({ id: 'admin-id', isActive: false });

    await expect(
      new DeactivateUserUseCase(usersRepository).execute(
        'admin-id',
        administrator,
      ),
    ).resolves.toEqual({ id: 'admin-id', isActive: false });
  });

  it('purges deleted users older than 30 days', async () => {
    purgeDeletedBeforeMock.mockResolvedValue({ count: 4 });

    await expect(
      new PurgeDeletedUsersUseCase(usersRepository).execute(),
    ).resolves.toEqual({ count: 4 });
    expect(purgeDeletedBeforeMock).toHaveBeenCalledWith(expect.any(Date));
  });
});
