import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/generated/prisma/client';
import { ValidateAccessTokenUseCase } from '../use-cases/validate-access-token.use-case';
import { JwtStrategy } from './jwt.strategy';

const passportOptions = jest.fn();

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: () =>
    class {
      constructor(options: unknown) {
        passportOptions(options);
      }
    },
}));

describe('JwtStrategy', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('super-secret-jwt-key-32-chars-min'),
  };
  const validateAccessTokenUseCase = { execute: jest.fn() };

  it('configures passport-jwt and validates payload via ValidateAccessTokenUseCase', async () => {
    const strategy = new JwtStrategy(
      configService as unknown as ConfigService,
      validateAccessTokenUseCase as unknown as ValidateAccessTokenUseCase,
    );
    const authenticatedUser = {
      id: 'user-1',
      login: 'admin',
      role: UserRole.ADMIN,
    };
    validateAccessTokenUseCase.execute.mockResolvedValue(authenticatedUser);

    expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
    expect(passportOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreExpiration: false,
        secretOrKey: 'super-secret-jwt-key-32-chars-min',
      }),
    );
    await expect(strategy.validate({ sub: 'user-1' })).resolves.toEqual(
      authenticatedUser,
    );
    expect(validateAccessTokenUseCase.execute).toHaveBeenCalledWith('user-1');
  });
});
