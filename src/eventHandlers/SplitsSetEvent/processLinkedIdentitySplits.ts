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
  );

  assertIsRepoDriverId(accountId);

  const existingSplits = await SplitsReceiverModel.findAll({
    where: { senderAccountId: accountId },
    transaction,
  });

  // ORCID accounts should have exactly one splits receiver (100% to owner).
  if (existingSplits.length > 1) {
    const errorMsg = `Found ${existingSplits.length} splits receivers for ORCID account ${accountId}, expected 1`;
    scopedLogger.bufferMessage(errorMsg);
    throw new Error(errorMsg);
  }

  if (existingSplits.length > 0) {
    await SplitsReceiverModel.destroy({
      where: { senderAccountId: accountId },
      transaction,
    });
  }

  // Create the ORCID splits record (100% to owner).
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
    `Updated splits record for ORCID account ${accountId} with 100% to owner ${linkedIdentity.ownerAccountId}`,
  );

  linkedIdentity.isLinked = isLinked;

  scopedLogger.bufferUpdate({
    type: LinkedIdentityModel,
    id: linkedIdentity.accountId,
    input: linkedIdentity,
  });

  await linkedIdentity.save({ transaction });
}
