import type { Transaction } from 'sequelize';
import type ScopedLogger from '../../core/ScopedLogger';
import LinkedIdentityModel from '../../models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../utils/validateLinkedIdentity';
import RecoverableError from '../../utils/recoverableError';
import type SplitsSetEventModel from '../../models/SplitsSetEventModel';
import { dripsContract } from '../../core/contractClients';

export async function setLinkedIdentityFlag(
  { accountId, receiversHash: eventReceiversHash }: SplitsSetEventModel,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const onChainReceiversHash = await dripsContract.splitsHash(accountId);

  // Only proceed if this event matches the latest on-chain hash.
  if (eventReceiversHash !== onChainReceiversHash) {
    scopedLogger.bufferMessage(
      `Skipped setting 'isLinked' flag for ${accountId}: on-chain splits hash '${onChainReceiversHash}' does not match event hash '${eventReceiversHash}'.`,
    );

    return;
  }

  const linkedIdentity = await LinkedIdentityModel.findOne({
    where: { accountId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!linkedIdentity) {
    throw new RecoverableError(
      `Failed to set 'isLinked' flag for LinkedIdentity: Linked Identity '${accountId}' not found. Likely waiting on 'OwnerUpdated' event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }

  const isLinked = await validateLinkedIdentity(
    accountId,
    linkedIdentity.ownerAccountId,
  );

  linkedIdentity.isLinked = isLinked;

  scopedLogger.bufferUpdate({
    type: LinkedIdentityModel,
    id: linkedIdentity.accountId,
    input: linkedIdentity,
  });

  await linkedIdentity.save({ transaction });
}
