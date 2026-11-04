import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(dto: CreateUserDto, actor?: AuthenticatedUser) {
    const activeUsers = await this.usersRepository.countActive();

    if (activeUsers > 0 && !actor) {
      throw new UnauthorizedException('Authentication is required');
    }

    if (activeUsers > 0 && actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can create users');
    }

    if (await this.usersRepository.findByLoginOrEmail(dto.login, dto.email)) {
      throw new ConflictException('Login or email is already in use');
    }

    return this.usersRepository.create({
      name: dto.name,
      login: dto.login,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: dto.role ?? UserRole.ATTENDANT,
    });
  }
}
