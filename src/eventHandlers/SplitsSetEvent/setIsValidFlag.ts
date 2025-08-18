import type { Transaction } from 'sequelize';
import type { AccountId } from '../../core/types';
import {
  calcSubRepoDriverId,
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
import { checkIncompleteDeadlineReceivers } from '../../utils/checkIncompleteDeadlineReceivers';

export default async function setIsValidFlag(
  { accountId, receiversHash: eventReceiversHash }: SplitsSetEventModel,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const onChainReceiversHash = await dripsContract.splitsHash(accountId);

  if (eventReceiversHash !== onChainReceiversHash) {
    scopedLogger.bufferMessage(
      `Skipped setting 'isValid' flag for ${accountId}: on-chain splits hash '${onChainReceiversHash}' does not match event hash '${eventReceiversHash}'.`,
    );
    return;
  }

  if (isRepoDriverId(accountId)) {
    await handleEntityValidation(
      accountId,
      onChainReceiversHash,
      transaction,
      scopedLogger,
      {
        findEntity: async () => {
          const project = await ProjectModel.findByPk(accountId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!project) {
            throw new RecoverableError(
              `Failed to set 'isValid' flag for Project: Project '${accountId}' not found. Likely waiting on 'AccountMetadataEmitted' event to be processed. Retrying, but if this persists, it is a real error.`,
            );
          }

          return {
            entity: project,
            Model: ProjectModel,
            entityType: 'Project',
          };
        },
        validateOwnership: async (entity) => {
          const onChainOwner = await repoDriverContract.ownerOf(accountId);
          const dbOwner = entity.ownerAddress;
          if (onChainOwner !== dbOwner) {
            throw new RecoverableError(
              `On-chain owner ${onChainOwner} does not match DB owner ${dbOwner} for Project '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
            );
          }
        },
      },
    );
  } else if (isNftDriverId(accountId)) {
    await handleEntityValidation(
      accountId,
      onChainReceiversHash,
      transaction,
      scopedLogger,
      {
        findEntity: async () => {
          const dripList = await DripListModel.findByPk(accountId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          const ecosystemMain = await EcosystemMainAccountModel.findByPk(
            accountId,
            {
              transaction,
              lock: transaction.LOCK.UPDATE,
            },
          );

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

          return { entity, Model, entityType: Model.name };
        },
        validateOwnership: async (entity) => {
          const onChainOwner = await nftDriverContract.ownerOf(accountId);
          const dbOwner = entity.ownerAddress;
          if (onChainOwner !== dbOwner) {
            const entityType = entity.constructor.name;
            throw new RecoverableError(
              `On-chain owner ${onChainOwner} does not match DB owner ${dbOwner} for ${entityType} '${accountId}'. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
            );
          }
        },
      },
    );
  } else if (isImmutableSplitsDriverId(accountId)) {
    await handleEntityValidation(
      accountId,
      onChainReceiversHash,
      transaction,
      scopedLogger,
      {
        findEntity: async () => {
          const subList = await SubListModel.findByPk(accountId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!subList) {
            throw new RecoverableError(
              `Failed to set 'isValid' flag for SubList: SubList '${accountId}' not found.`,
            );
          }

          return {
            entity: subList,
            Model: SubListModel,
            entityType: 'SubList',
          };
        },
      },
    );
  }
}
type EntityWithValidation = {
  isValid: boolean;
  accountId: AccountId;
  ownerAddress?: string | null;
  save: (options: { transaction: Transaction }) => Promise<any>;
};

type EntityFinder = {
  findEntity: () => Promise<{
    entity: EntityWithValidation;
    Model: any;
    entityType: string;
  }>;
  validateOwnership?: (entity: EntityWithValidation) => Promise<void>;
};

async function handleEntityValidation(
  accountId: AccountId,
  onChainReceiversHash: string,
  transaction: Transaction,
  scopedLogger: ScopedLogger,
  entityFinder: EntityFinder,
): Promise<void> {
  const { entity, Model, entityType } = await entityFinder.findEntity();

  if (entityFinder.validateOwnership) {
    await entityFinder.validateOwnership(entity);
  }

  const { hashValid } = await validateSplitsHash(
    accountId,
    onChainReceiversHash,
    transaction,
    scopedLogger,
    entityType,
  );

  const { hasIncompleteDeadlines } = await validateDeadlineReceivers(
    accountId,
    transaction,
    scopedLogger,
    entityType,
  );

  const isValid = hashValid && !hasIncompleteDeadlines;

  entity.isValid = isValid;

  scopedLogger.bufferUpdate({
    id: entity.accountId,
    type: Model,
    input: entity as any,
  });

  await entity.save({ transaction });

  if (!isValid) {
    const reasons = [];
    if (!hashValid) reasons.push('splits hash mismatch');
    if (hasIncompleteDeadlines) reasons.push('incomplete deadline receivers');

    throw new RecoverableError(
      `${entityType} '${accountId}' validation failed: ${reasons.join(', ')}. Likely waiting on another event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }
}

async function validateSplitsHash(
  accountId: AccountId,
  onChainReceiversHash: string,
  transaction: Transaction,
  scopedLogger: ScopedLogger,
  entityType: string,
): Promise<{
  hashValid: boolean;
  dbReceiversHash: string;
}> {
  const dbReceiversHash = await hashDbSplits(accountId, transaction);
  const hashValid = dbReceiversHash === onChainReceiversHash;

  if (!hashValid) {
    scopedLogger.bufferMessage(
      `${entityType} ${accountId} splits hash mismatch: on-chain '${onChainReceiversHash}' vs DB '${dbReceiversHash}'`,
    );
  }

  return { hashValid, dbReceiversHash };
}

async function validateDeadlineReceivers(
  accountId: AccountId,
  transaction: Transaction,
  scopedLogger: ScopedLogger,
  entityType: string,
): Promise<{
  hasIncompleteDeadlines: boolean;
}> {
  const hasIncompleteDeadlines = await checkIncompleteDeadlineReceivers(
    accountId,
    transaction,
  );

  if (hasIncompleteDeadlines) {
    scopedLogger.bufferMessage(
      `${entityType} ${accountId} has splits pointing to incomplete deadline accounts`,
    );
  }

  return { hasIncompleteDeadlines };
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

  const receiverPromises = rows.map(async (s) => {
    let receiverId = s.receiverAccountId;
    if (s.splitsToRepoDriverSubAccount) {
      receiverId = await calcSubRepoDriverId(s.receiverAccountId);
    }

    return {
      accountId: receiverId,
      weight: s.weight,
    };
  });

  const receivers = await Promise.all(receiverPromises);

  return dripsContract.hashSplits(formatSplitReceivers(receivers));
}
