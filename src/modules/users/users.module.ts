import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UserPurgeScheduler } from './user-purge.scheduler';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserUseCase } from './use-cases/create-user.use-case';
import { DeactivateUserUseCase } from './use-cases/deactivate-user.use-case';
import { GetUserUseCase } from './use-cases/get-user.use-case';
import { ListUsersUseCase } from './use-cases/list-users.use-case';
import { PurgeDeletedUsersUseCase } from './use-cases/purge-deleted-users.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    UsersRepository,
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    UpdateUserUseCase,
    DeactivateUserUseCase,
    PurgeDeletedUsersUseCase,
    UserPurgeScheduler,
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
