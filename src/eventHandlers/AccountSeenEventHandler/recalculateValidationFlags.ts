import type { Transaction, Model } from 'sequelize';
import type { AccountId } from '../../core/types';
import type ScopedLogger from '../../core/ScopedLogger';
import {
  ProjectModel,
  DripListModel,
  EcosystemMainAccountModel,
  SubListModel,
  LinkedIdentityModel,
  SplitsReceiverModel,
} from '../../models';
import {
  dripsContract,
  nftDriverContract,
  repoDriverContract,
} from '../../core/contractClients';
import { calcSubRepoDriverId } from '../../utils/accountIdUtils';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import { checkIncompleteDeadlineReceivers } from '../../utils/checkIncompleteDeadlineReceivers';
import { validateLinkedIdentity } from '../../utils/validateLinkedIdentity';
import RecoverableError from '../../utils/recoverableError';
import type { AffectedAccount } from './findAffectedAccounts';

/**
 * Recalculates and updates validation flags (isValid/isLinked).
 */
export async function recalculateValidationFlags(
  affectedAccounts: AffectedAccount[],
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  for (const { accountId, type } of affectedAccounts) {
    if (type === 'LinkedIdentity') {
      await recalculateLinkedIdentityFlag(accountId, scopedLogger, transaction);
    } else {
      await recalculateIsValidFlag(accountId, type, scopedLogger, transaction);
    }
  }
}

async function recalculateLinkedIdentityFlag(
  accountId: AccountId,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const linkedIdentity = await LinkedIdentityModel.findByPk(accountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!linkedIdentity) {
    throw new RecoverableError(
      `LinkedIdentity ${accountId} not found during recalculation. Waiting for entity creation.`,
    );
  }

  const previousIsLinked = linkedIdentity.isLinked;
  const newIsLinked = await validateLinkedIdentity(
    accountId,
    linkedIdentity.ownerAccountId,
    transaction,
  );

  if (previousIsLinked !== newIsLinked) {
    linkedIdentity.isLinked = newIsLinked;

    scopedLogger.bufferUpdate({
      id: accountId,
      type: LinkedIdentityModel,
      input: linkedIdentity,
    });

    await linkedIdentity.save({ transaction });

    scopedLogger.bufferMessage(
      `Recalculated LinkedIdentity ${accountId} isLinked flag: ${previousIsLinked} → ${newIsLinked}`,
    );
  }
}

type ValidatableAccountType =
  | 'Project'
  | 'DripList'
  | 'SubList'
  | 'EcosystemMainAccount';

type ValidatableAccount = Model & {
  isValid: boolean;
  [key: string]: any;
};

type ValidatableModelStatic = {
  findByPk: (
    accountId: AccountId,
    options: { transaction: Transaction; lock: any },
  ) => Promise<ValidatableAccount | null>;
} & (abstract new (...args: any[]) => ValidatableAccount);

type ContractClient = {
  ownerOf: (accountId: AccountId) => Promise<string>;
};

type ValidationConfig = {
  model: ValidatableModelStatic;
  contractClient?: ContractClient | null;
  ownerField: string;
  skipOwnerCheck?: boolean;
};

const VALIDATION_CONFIGS: Record<ValidatableAccountType, ValidationConfig> = {
  Project: {
    model: ProjectModel,
    contractClient: repoDriverContract,
    ownerField: 'ownerAddress',
  },
  DripList: {
    model: DripListModel,
    contractClient: nftDriverContract,
    ownerField: 'ownerAddress',
  },
  EcosystemMainAccount: {
    model: EcosystemMainAccountModel,
    contractClient: nftDriverContract,
    ownerField: 'ownerAddress',
  },
  SubList: {
    model: SubListModel,
    contractClient: null,
    ownerField: 'ownerAddress',
    skipOwnerCheck: true,
  },
};

async function recalculateAccountIsValid(
  accountId: AccountId,
  type: ValidatableAccountType,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  const config = VALIDATION_CONFIGS[type];
  const account = await config.model.findByPk(accountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!account) {
    throw new RecoverableError(
      `${type} ${accountId} not found during recalculation. Waiting for entity creation.`,
    );
  }

  const onChainReceiversHash = await dripsContract.splitsHash(accountId);

  let onChainOwner: string | null = null;
  if (!config.skipOwnerCheck && config.contractClient) {
    onChainOwner = await config.contractClient.ownerOf(accountId);
  }

  const dbReceiversHash = await hashDbSplits(accountId, transaction);

  // Skip if owner mismatch (temporary state).
  if (!config.skipOwnerCheck && onChainOwner !== account[config.ownerField]) {
    throw new RecoverableError(
      `Owner mismatch for ${type} ${accountId}: on-chain ${onChainOwner} vs DB ${account[config.ownerField]}. Waiting for owner update.`,
    );
  }

  const hashValid = dbReceiversHash === onChainReceiversHash;
  const hasIncompleteDeadlines = await checkIncompleteDeadlineReceivers(
    accountId,
    transaction,
  );

  const previousIsValid = account.isValid;
  const newIsValid = hashValid && !hasIncompleteDeadlines;

  if (previousIsValid !== newIsValid) {
    account.isValid = newIsValid;

    scopedLogger.bufferUpdate({
      id: accountId,
      type: config.model,
      input: account,
    });

    await account.save({ transaction });

    scopedLogger.bufferMessage(
      `Recalculated ${type} ${accountId} isValid flag: ${previousIsValid} → ${newIsValid}`,
    );
  }
}

async function recalculateIsValidFlag(
  accountId: AccountId,
  type: ValidatableAccountType,
  scopedLogger: ScopedLogger,
  transaction: Transaction,
): Promise<void> {
  await recalculateAccountIsValid(accountId, type, scopedLogger, transaction);
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

  const receivers = [];
  for (const s of rows) {
    let receiverId = s.receiverAccountId;
    if (s.splitsToRepoDriverSubAccount) {
      receiverId = await calcSubRepoDriverId(s.receiverAccountId);
    }

    receivers.push({
      accountId: receiverId,
      weight: s.weight,
    });
  }

  return dripsContract.hashSplits(formatSplitReceivers(receivers));
}
