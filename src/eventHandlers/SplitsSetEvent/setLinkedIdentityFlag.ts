import type { Transaction } from 'sequelize';
import type ScopedLogger from '../../core/ScopedLogger';
import type { AccountId } from '../../core/types';
import LinkedIdentityModel from '../../models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../utils/validateLinkedIdentity';

export async function setLinkedIdentityFlag(
  accountId: AccountId,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const linkedIdentity = await LinkedIdentityModel.findOne({
    where: { accountId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!linkedIdentity) {
    scopedLogger.log(
      `No LinkedIdentity found for account ${accountId}, skipping isLinked update`,
    );
    return;
  }

  const isLinked = await validateLinkedIdentity(
    accountId,
    linkedIdentity.ownerAccountId,
  );

  if (linkedIdentity.isLinked !== isLinked) {
    linkedIdentity.isLinked = isLinked;
    await linkedIdentity.save({ transaction });

    scopedLogger.bufferUpdate({
      type: LinkedIdentityModel,
      id: linkedIdentity.accountId,
      input: linkedIdentity,
    });

    scopedLogger.log(
      `Updated LinkedIdentity ${accountId} isLinked flag to ${isLinked}`,
    );
  }
}
