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
    }),
    await DripListSplitReceiverModel.findAll({
      where: {
        [Op.or]: [
          { funderProjectId: emmiterAccountId },
          { funderDripListId: emmiterAccountId },
        ],
      },
    }),
    await RepoDriverSplitReceiverModel.findAll({
      where: {
        [Op.or]: [
          { funderProjectId: emmiterAccountId },
          { funderDripListId: emmiterAccountId },
        ],
      },
    }),
  ]);

  const allSplits = [...addressSplits, ...dripListSplits, ...projectSplits].map(
    extractAccountId,
  );
  const accountIds = allSplits.map(extractAccountId);

  return accountIds;
}

export async function getCurrentSplitsByReceiversHash(
  receiversHash: string,
): Promise<AccountId[]> {
  const streamReceiverSeenEvents = await StreamReceiverSeenEventModel.findAll({
    where: {
      receiversHash,
    },
  });

  const accountIds = streamReceiverSeenEvents.map((event) => event.accountId);

  return Array.from(new Set(accountIds));
}

function extractAccountId(split: any): AccountId {
  const { funderProjectId, funderDripListId } = split;

  if (funderProjectId && funderDripListId) {
    throw new Error(
      "Invalid split record: both 'funderProjectId' and 'funderDripListId are set.",
    );
  }

  return funderProjectId || funderDripListId;
}
