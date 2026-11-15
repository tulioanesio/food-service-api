import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/generated/prisma/client';
import { UsersRepository } from 'src/modules/users/repositories/users.repository';
import { LoginUseCase } from './login.use-case';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('LoginUseCase', () => {
  const usersRepository = {
    findByLoginOrEmail: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  const useCase = new LoginUseCase(
    usersRepository as unknown as UsersRepository,
    jwtService as unknown as JwtService,
  );

  const activeUser = {
    id: 'u1',
    name: 'Admin User',
    login: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    passwordHash: 'hashed-password',
    isActive: true,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns accessToken and sanitized user for valid active credentials', async () => {
    usersRepository.findByLoginOrEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('signed-jwt');

    const result = await useCase.execute({
      login: 'admin',
      password: 'secret',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'u1',
      role: UserRole.ADMIN,
    });
    expect(result).toEqual({
      accessToken: 'signed-jwt',
      user: {
        id: 'u1',
        name: 'Admin User',
        login: 'admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    });
  });

  it('throws UnauthorizedException when user is not found', async () => {
    usersRepository.findByLoginOrEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ login: 'missing', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    usersRepository.findByLoginOrEmail.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      useCase.execute({ login: 'admin', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is soft-deleted', async () => {
    usersRepository.findByLoginOrEmail.mockResolvedValue({
      ...activeUser,
      deletedAt: new Date(),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      useCase.execute({ login: 'admin', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password does not match', async () => {
    usersRepository.findByLoginOrEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      useCase.execute({ login: 'admin', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
