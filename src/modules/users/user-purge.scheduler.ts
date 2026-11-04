import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeDeletedUsersUseCase } from './use-cases/purge-deleted-users.use-case';

@Injectable()
export class UserPurgeScheduler {
  constructor(
    private readonly purgeDeletedUsersUseCase: PurgeDeletedUsersUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  purgeDeletedUsers(): Promise<{ count: number }> {
    return this.purgeDeletedUsersUseCase.execute();
  }
}
