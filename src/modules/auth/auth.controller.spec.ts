import { AuthController } from './auth.controller';
import { LoginUseCase } from './use-cases/login.use-case';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

describe('AuthController', () => {
  const loginUseCase = { execute: jest.fn() };
  const controller = new AuthController(
    loginUseCase as unknown as LoginUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates login to LoginUseCase', async () => {
    const dto = { login: 'admin', password: 'secret' };
    const result = { accessToken: 'token', user: { id: 'u1' } };
    loginUseCase.execute.mockResolvedValue(result);

    await expect(controller.login(dto)).resolves.toEqual(result);
    expect(loginUseCase.execute).toHaveBeenCalledWith(dto);
  });
});
