import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class DeactivateUserUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(id: string, actor: AuthenticatedUser) {
    if (actor.id !== id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only the user or an administrator can deactivate this account',
      );
    }

    const user = await this.usersRepository.findActiveByIdWithCredentials(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      const activeAdministrators =
        await this.usersRepository.countActiveAdministrators();

      if (activeAdministrators <= 1) {
        throw new ForbiddenException(
          'The last administrator cannot be deactivated',
        );
      }
    }

    return this.usersRepository.deactivate(id);
  }
}
