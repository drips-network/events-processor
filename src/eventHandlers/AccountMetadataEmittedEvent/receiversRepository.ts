import { type Transaction } from 'sequelize';
import type { AccountId } from '../../core/types';
import type LogManager from '../../core/LogManager';
import type { SplitReceiverShape } from '../../core/splitRules';
import { SplitReceiver, StreamReceiverSeenEventModel } from '../../models';

export async function deleteExistingSplitReceivers(
  senderAccountId: AccountId,
  transaction: Transaction,
) {
  await SplitReceiver.destroy({
    where: {
      senderAccountId,
    },
    transaction,
  });
}

export async function createSplitReceiver({
  logManager,
  transaction,
  splitReceiverShape,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  splitReceiverShape: SplitReceiverShape;
}) {
  const splitReceiver = await SplitReceiver.create(
    { ...splitReceiverShape },
    { transaction },
  );

  logManager.appendCreateLog(SplitReceiver, splitReceiver.id.toString());
}

export async function getCurrentSplitReceiversBySender(
  senderAccountId: AccountId,
): Promise<AccountId[]> {
  const splitReceivers = await SplitReceiver.findAll({
    where: {
      senderAccountId,
    },
    lock: true,
  });

  const accountIds = [
    ...splitReceivers.map((receiver) => receiver.senderAccountId),
  ];

  return Array.from(new Set(accountIds));
}

export async function getCurrentSplitReceiversByReceiversHash(
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
