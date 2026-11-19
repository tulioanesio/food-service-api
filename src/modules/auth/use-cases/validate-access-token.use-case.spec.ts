import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import { UsersRepository } from 'src/modules/users/repositories/users.repository';
import { ValidateAccessTokenUseCase } from './validate-access-token.use-case';

describe('ValidateAccessTokenUseCase', () => {
  const usersRepository = {
    findActiveByIdWithCredentials: jest.fn(),
  };
  const useCase = new ValidateAccessTokenUseCase(
    usersRepository as unknown as UsersRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns authenticated user info when user is active', async () => {
    usersRepository.findActiveByIdWithCredentials.mockResolvedValue({
      id: 'u1',
      login: 'admin',
      role: UserRole.ADMIN,
    });

    await expect(useCase.execute('u1')).resolves.toEqual({
      id: 'u1',
      login: 'admin',
      role: UserRole.ADMIN,
    });
    expect(usersRepository.findActiveByIdWithCredentials).toHaveBeenCalledWith(
      'u1',
    );
  });

  it('throws UnauthorizedException when user is inactive or missing', async () => {
    usersRepository.findActiveByIdWithCredentials.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
