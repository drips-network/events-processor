import type { Transaction } from 'sequelize';
import type { AccountId } from '../../core/types';
import {
  isImmutableSplitsDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../utils/accountIdUtils';
import {
  dripsContract,
  nftDriverContract,
  repoDriverContract,
} from '../../core/contractClients';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import RecoverableError from '../../utils/recoverableError';
import {
  ProjectModel,
  DripListModel,
  EcosystemMainAccountModel,
  SubListModel,
  SplitsReceiverModel,
} from '../../models';
import type SplitsSetEventModel from '../../models/SplitsSetEventModel';
import type ScopedLogger from '../../core/ScopedLogger';
import unreachableError from '../../utils/unreachableError';

export default async function setIsValidFlag(
  { accountId, receiversHash: eventReceiversHash }: SplitsSetEventModel,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const onChainReceiversHash = await dripsContract.splitsHash(accountId);

  // Only proceed if this event matches the latest on-chain hash.
  if (eventReceiversHash !== onChainReceiversHash) {
    scopedLogger.bufferMessage(
      `Skipped setting 'isValid' flag for ${accountId}: on-chain splits hash '${onChainReceiversHash}' does not match event hash '${eventReceiversHash}'.`,
    );

    return;
  }

  if (isRepoDriverId(accountId)) {
    const project = await ProjectModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!project) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for Project: Project '${accountId}' not found. Likely waiting on 'AccountMetadataEmitted' event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }

    const onChainOwner = await repoDriverContract.ownerOf(accountId);
    const dbOwner = project.ownerAddress; // populated from metadata.
    if (onChainOwner !== dbOwner) {
      throw new RecoverableError(
        `On-chain owner ${onChainOwner} does not match DB owner ${dbOwner} for Project '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }

    const dbReceiversHash = await hashDbSplits(accountId, transaction);
    const isValid = dbReceiversHash === onChainReceiversHash;

    project.isValid = isValid;

    scopedLogger.bufferUpdate({
      id: project.accountId,
      type: ProjectModel,
      input: project,
    });

    await project.save({ transaction });

    if (!isValid) {
      // Rethrow the error to trigger a retry. Eventually, the on-chain hash should match the DB hash.
      throw new RecoverableError(
        `On-chain splits hash '${onChainReceiversHash}' does not match DB splits hash '${dbReceiversHash}' for Project '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }
  } else if (isNftDriverId(accountId)) {
    const dripList = await DripListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const ecosystemMain = await EcosystemMainAccountModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const entity = dripList ?? ecosystemMain!;
    const Model = dripList ? DripListModel : EcosystemMainAccountModel;

    if (!entity) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for ${Model.name}: ${Model.name} '${accountId}' not found.`,
      );
    }

    if (dripList && ecosystemMain) {
      unreachableError(
        `Invariant violation: both Drip List and Ecosystem Main Account found for token '${accountId}'.`,
      );
    }

    const onChainOwner = await nftDriverContract.ownerOf(accountId);
    const dbOwner = entity.ownerAddress;
    if (onChainOwner !== dbOwner) {
      throw new RecoverableError(
        `On-chain owner ${onChainOwner} does not match DB owner ${dbOwner} for ${Model.name} '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }

    const dbReceiversHash = await hashDbSplits(accountId, transaction);
    const isValid = dbReceiversHash === onChainReceiversHash;

    entity.isValid = isValid;

    scopedLogger.bufferUpdate({
      id: entity.accountId,
      type: Model,
      input: entity,
    });

    await entity.save({ transaction });

    if (!isValid) {
      // Rethrow the error to trigger a retry. Eventually, the on-chain hash should match the DB hash.
      throw new RecoverableError(
        `On-chain splits hash '${onChainReceiversHash}' does not match DB splits hash '${dbReceiversHash}' for ${Model.name} '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }
  } else if (isImmutableSplitsDriverId(accountId)) {
    const subList = await SubListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!subList) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for SubList: SubList '${accountId}' not found.`,
      );
    }

    const dbReceiversHash = await hashDbSplits(accountId, transaction);
    const isValid = dbReceiversHash === onChainReceiversHash;

    subList.isValid = isValid;

    scopedLogger.bufferUpdate({
      id: subList.accountId,
      type: SubListModel,
      input: subList,
    });

    await subList.save({ transaction });

    if (!isValid) {
      // Rethrow the error to trigger a retry. Eventually, the on-chain hash should match the DB hash.
      throw new RecoverableError(
        `On-chain splits hash '${onChainReceiversHash}' does not match DB splits hash '${dbReceiversHash}' for SubList '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
      );
    }
  }
}

async function hashDbSplits(
  accountId: AccountId,
  transaction: Transaction,
): Promise<string> {
  const rows = await SplitsReceiverModel.findAll({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { senderAccountId: accountId },
  });

  const receivers = rows.map((r) => ({
    accountId: r.receiverAccountId,
    weight: r.weight,
  }));

  return dripsContract.hashSplits(formatSplitReceivers(receivers));
}
