import { PurgeDeletedUsersUseCase } from './use-cases/purge-deleted-users.use-case';
import { UserPurgeScheduler } from './user-purge.scheduler';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_MIDNIGHT: '0 0 * * *' },
}));

describe('UserPurgeScheduler', () => {
  it('delegates purgeDeletedUsers to PurgeDeletedUsersUseCase', async () => {
    const purgeUseCase = {
      execute: jest.fn().mockResolvedValue({ count: 3 }),
    };
    const scheduler = new UserPurgeScheduler(
      purgeUseCase as unknown as PurgeDeletedUsersUseCase,
    );

    await expect(scheduler.purgeDeletedUsers()).resolves.toEqual({ count: 3 });
    expect(purgeUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
