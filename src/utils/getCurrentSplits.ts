import { Op } from 'sequelize';
import type { AccountId } from '../core/types';
import {
  AddressDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  RepoDriverSplitReceiverModel,
  StreamReceiverSeenEventModel,
} from '../models';

export async function getCurrentSplitsByAccountId(
  emmiterAccountId: AccountId,
): Promise<AccountId[]> {
  const [addressSplits, dripListSplits, projectSplits] = await Promise.all([
    await AddressDriverSplitReceiverModel.findAll({
      where: {
        [Op.or]: [
          { funderProjectId: emmiterAccountId },
          { funderDripListId: emmiterAccountId },
        ],
      },
      lock: true,
    }),
    await DripListSplitReceiverModel.findAll({
      where: {
        [Op.or]: [
          { funderProjectId: emmiterAccountId },
          { funderDripListId: emmiterAccountId },
        ],
      },
      lock: true,
    }),
    await RepoDriverSplitReceiverModel.findAll({
      where: {
        [Op.or]: [
          { funderProjectId: emmiterAccountId },
          { funderDripListId: emmiterAccountId },
        ],
      },
      lock: true,
    }),
  ]);

  const accountIds = [
    ...addressSplits.map((receiver) => receiver.fundeeAccountId),
    ...dripListSplits.map((receiver) => receiver.fundeeDripListId),
    ...projectSplits.map((receiver) => receiver.fundeeProjectId),
  ];

  return Array.from(new Set(accountIds));
}

export async function getCurrentSplitsByReceiversHash(
  receiversHash: string,
): Promise<AccountId[]> {
  const streamReceiverSeenEvents = await StreamReceiverSeenEventModel.findAll({
    where: {
      receiversHash,
    },
    lock: true,
  });

  const accountIds = streamReceiverSeenEvents.map((event) => event.accountId);

  return Array.from(new Set(accountIds));
}
