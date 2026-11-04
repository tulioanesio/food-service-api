import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class GetUserUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(id: string, actor: AuthenticatedUser) {
    const canViewAnyUser =
      actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER;

    if (actor.id !== id && !canViewAnyUser) {
      throw new ForbiddenException('Users can only view their own profile');
    }

    const user = await this.usersRepository.findActiveById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
