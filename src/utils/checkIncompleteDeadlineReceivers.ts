import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import AccountSeenEventModel from '../models/AccountSeenEventModel';
import SplitsReceiverModel from '../models/SplitsReceiverModel';
import { isRepoDeadlineDriverId } from './accountIdUtils';
import type { AccountId, RepoDeadlineDriverId } from '../core/types';

export async function checkIncompleteDeadlineReceivers(
  senderAccountId: AccountId,
  transaction: Transaction,
): Promise<boolean> {
  const splitsReceivers = await SplitsReceiverModel.findAll({
    where: { senderAccountId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const deadlineReceivers = splitsReceivers.filter((receiver) =>
    isRepoDeadlineDriverId(receiver.receiverAccountId),
  );

  if (deadlineReceivers.length === 0) {
    return false;
  }

  const receiverAccountIds = deadlineReceivers.map(
    (r) => r.receiverAccountId as RepoDeadlineDriverId,
  );

  const existingAccountSeenEvents = await AccountSeenEventModel.findAll({
    where: {
      accountId: {
        [Op.in]: receiverAccountIds,
      },
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  // Check if any receivers are missing
  const existingAccountIds = new Set(
    existingAccountSeenEvents.map((e) => e.accountId),
  );
  return receiverAccountIds.some((id) => !existingAccountIds.has(id));
}
