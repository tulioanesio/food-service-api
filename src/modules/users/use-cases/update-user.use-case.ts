import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    if (actor.id !== id) {
      throw new ForbiddenException('Users can only update their own profile');
    }

    if (!(await this.usersRepository.findActiveByIdWithCredentials(id))) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.usersRepository.update(id, {
        name: dto.name,
        email: dto.email,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, 12)
          : undefined,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already in use');
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
