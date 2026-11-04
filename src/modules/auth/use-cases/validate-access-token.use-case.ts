import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from 'src/modules/users/repositories/users.repository';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class ValidateAccessTokenUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(userId: string): Promise<AuthenticatedUser> {
    const user =
      await this.usersRepository.findActiveByIdWithCredentials(userId);

    if (!user) {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
    };
  }
}
