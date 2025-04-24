import { type Transaction } from 'sequelize';
import type { AccountId } from '../../core/types';
import type ScopedLogger from '../../core/ScopedLogger';
import type { SplitReceiverShape } from '../../core/splitRules';
import { SplitReceiverModel, StreamReceiverSeenEventModel } from '../../models';

export async function deleteExistingSplitReceivers(
  senderAccountId: AccountId,
  transaction: Transaction,
) {
  await SplitReceiverModel.destroy({
    where: {
      senderAccountId,
    },
    transaction,
  });
}

export async function createSplitReceiver({
  scopedLogger,
  transaction,
  splitReceiverShape,
}: {
  blockTimestamp: Date;
  scopedLogger: ScopedLogger;
  transaction: Transaction;
  splitReceiverShape: SplitReceiverShape;
}) {
  const splitReceiver = await SplitReceiverModel.create(
    { ...splitReceiverShape },
    { transaction },
  );

  scopedLogger.bufferCreation({
    input: splitReceiver,
    type: SplitReceiverModel,
    id: splitReceiver.id.toString(),
  });
}

export async function getCurrentSplitReceiversBySender(
  senderAccountId: AccountId,
): Promise<AccountId[]> {
  const splitReceivers = await SplitReceiverModel.findAll({
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
