import type { Transaction } from 'sequelize';
import type ScopedLogger from '../../core/ScopedLogger';
import LinkedIdentityModel from '../../models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../utils/validateLinkedIdentity';
import RecoverableError from '../../utils/recoverableError';
import type SplitsSetEventModel from '../../models/SplitsSetEventModel';
import { dripsContract } from '../../core/contractClients';
import { SplitsReceiverModel } from '../../models';
import { createSplitReceiver } from '../AccountMetadataEmittedEvent/receiversRepository';
import { assertIsRepoDriverId } from '../../utils/accountIdUtils';

export async function processLinkedIdentitySplits(
  {
    accountId,
    receiversHash: eventReceiversHash,
    blockTimestamp,
  }: SplitsSetEventModel,
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
    transaction,
  );

  assertIsRepoDriverId(accountId);

  // Always delete existing splits to ensure clean state.
  const deletedCount = await SplitsReceiverModel.destroy({
    where: { senderAccountId: accountId },
    transaction,
  });

  if (deletedCount > 1) {
    scopedLogger.log(
      `Deleted ${deletedCount} splits receivers for ORCID account ${accountId}, expected 0 or 1`,
      'warn',
    );
  }

  // Only create new splits if identity is properly linked.
  if (isLinked) {
    await createSplitReceiver({
      scopedLogger,
      transaction,
      splitReceiverShape: {
        senderAccountType: 'linked_identity',
        senderAccountId: accountId,
        receiverAccountType: 'address',
        receiverAccountId: linkedIdentity.ownerAccountId,
        relationshipType: 'identity_owner',
        weight: 1_000_000, // 100% in Drips weight format.
        blockTimestamp,
      },
    });

    scopedLogger.bufferMessage(
      `Created valid splits record for linked ORCID account ${accountId} with 100% to owner ${linkedIdentity.ownerAccountId}`,
    );
  } else {
    scopedLogger.log(
      `ORCID account ${accountId} is not properly linked. On-chain splits don't match expected 100% to owner ${linkedIdentity.ownerAccountId}. No splits record created.`,
      'warn',
    );
  }

  linkedIdentity.isLinked = isLinked;

  scopedLogger.bufferUpdate({
    type: LinkedIdentityModel,
    id: linkedIdentity.accountId,
    input: linkedIdentity,
  });

  await linkedIdentity.save({ transaction });
}
