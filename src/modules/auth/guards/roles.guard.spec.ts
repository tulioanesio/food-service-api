import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from '../auth.types';
import { ROLES_KEY } from '../auth.constants';
import { RolesGuard } from './roles.guard';

const createContext = (handler: object, user?: AuthenticatedUser) =>
  ({
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('returns 401 when a protected route has no authenticated user', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], handler);
    const guard = new RolesGuard(new Reflector());

    expect(() => guard.canActivate(createContext(handler))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns 403 when an authenticated user lacks the required role', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], handler);
    const guard = new RolesGuard(new Reflector());
    const user: AuthenticatedUser = {
      id: 'user-id',
      login: 'attendant',
      role: UserRole.ATTENDANT,
    };

    expect(() => guard.canActivate(createContext(handler, user))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an authenticated user with the required role', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], handler);
    const guard = new RolesGuard(new Reflector());
    const user: AuthenticatedUser = {
      id: 'admin-id',
      login: 'admin',
      role: UserRole.ADMIN,
    };

    expect(guard.canActivate(createContext(handler, user))).toBe(true);
  });
});
