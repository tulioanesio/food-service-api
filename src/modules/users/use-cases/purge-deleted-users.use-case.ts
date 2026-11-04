import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class PurgeDeletedUsersUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  execute() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.usersRepository.purgeDeletedBefore(cutoff);
  }
}
