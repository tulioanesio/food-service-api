import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../auth.constants';
import { JwtAuthGuard } from './jwt-auth.guard';

const superCanActivate = jest.fn<boolean, [ExecutionContext]>();

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      canActivate(context: ExecutionContext) {
        return superCanActivate(context);
      }
    },
}));

const createContext = (handler: object, authorization?: string) =>
  ({
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    superCanActivate.mockReset();
    superCanActivate.mockReturnValue(true);
  });

  it('allows public routes without calling passport AuthGuard', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    const guard = new JwtAuthGuard(new Reflector());

    expect(guard.canActivate(createContext(handler))).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('allows optional-auth routes when authorization header is absent', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(OPTIONAL_AUTH_KEY, true, handler);
    const guard = new JwtAuthGuard(new Reflector());

    expect(guard.canActivate(createContext(handler))).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('delegates optional-auth routes to passport when authorization header is present', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(OPTIONAL_AUTH_KEY, true, handler);
    const guard = new JwtAuthGuard(new Reflector());

    const ctx = createContext(handler, 'Bearer token');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(ctx);
  });

  it('delegates protected routes to passport AuthGuard', () => {
    const handler = () => undefined;
    const guard = new JwtAuthGuard(new Reflector());

    const ctx = createContext(handler);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(ctx);
  });
});
