import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from 'src/modules/auth/auth.types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { OptionalAuth } from 'src/modules/auth/decorators/optional-auth.decorator';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserUseCase } from './use-cases/create-user.use-case';
import { DeactivateUserUseCase } from './use-cases/deactivate-user.use-case';
import { GetUserUseCase } from './use-cases/get-user.use-case';
import { ListUsersUseCase } from './use-cases/list-users.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
  ) {}

  @OptionalAuth()
  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.createUserUseCase.execute(createUserDto, actor);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get()
  findAll() {
    return this.listUsersUseCase.execute();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.getUserUseCase.execute(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.updateUserUseCase.execute(id, updateUserDto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.deactivateUserUseCase.execute(id, actor);
  }
}
