import type { Transaction } from 'sequelize';
import type { AccountType } from '../core/splitRules';
import DripListModel from '../models/DripListModel';
import EcosystemMainAccountModel from '../models/EcosystemMainAccountModel';
import SubListModel from '../models/SubListModel';
import DeadlineModel from '../models/DeadlineModel';
import LinkedIdentityModel from '../models/LinkedIdentityModel';
import {
  getContractNameFromAccountId,
  convertToNftDriverId,
  convertToImmutableSplitsDriverId,
  convertToRepoDeadlineDriverId,
  convertToRepoDriverId,
  isOrcidAccount,
} from './accountIdUtils';
import type { AccountId } from '../core/types';
import RecoverableError from './recoverableError';

export async function getAccountType(
  accountId: AccountId,
  transaction: Transaction,
): Promise<AccountType> {
  const contractName = getContractNameFromAccountId(accountId);

  if (contractName === 'repoDriver' && isOrcidAccount(accountId)) {
    const linkedIdentity = await LinkedIdentityModel.findOne({
      lock: transaction.LOCK.UPDATE,
      where: {
        accountId: convertToRepoDriverId(accountId),
        identityType: 'orcid',
      },
      transaction,
      attributes: ['accountId'],
    });
    if (linkedIdentity) {
      return 'linked_identity';
    }
    throw new RecoverableError(
      `LinkedIdentity ${accountId} not found in database (yet?)`,
    );
  }

  // Projects don't need to exist in DB.
  if (
    contractName === 'repoDriver' ||
    contractName === 'repoSubAccountDriver'
  ) {
    return 'project';
  }

  // Addresses don't need to exist in DB.
  if (contractName === 'addressDriver') {
    return 'address';
  }

  // All other types must exist in DB.
  switch (contractName) {
    case 'immutableSplitsDriver': {
      const subList = await SubListModel.findByPk(
        convertToImmutableSplitsDriverId(accountId),
        { transaction, attributes: ['accountId'] },
      );
      if (!subList) {
        throw new RecoverableError(
          `SubList ${accountId} not found in database (yet?)`,
        );
      }
      return 'sub_list';
    }

    case 'repoDeadlineDriver': {
      const deadline = await DeadlineModel.findByPk(
        convertToRepoDeadlineDriverId(accountId),
        { transaction, attributes: ['accountId'] },
      );
      if (!deadline) {
        throw new RecoverableError(
          `Deadline ${accountId} not found in database (yet?)`,
        );
      }
      return 'deadline';
    }

    case 'nftDriver': {
      const nftDriverId = convertToNftDriverId(accountId);

      const ecosystem = await EcosystemMainAccountModel.findByPk(nftDriverId, {
        transaction,
        attributes: ['accountId'],
      });

      const dripList = await DripListModel.findByPk(nftDriverId, {
        transaction,
        attributes: ['accountId'],
      });

      if (ecosystem) return 'ecosystem_main_account';
      if (dripList) return 'drip_list';

      throw new RecoverableError(
        `NFTDriver entity ${accountId} not found in database (yet?)`,
      );
    }

    default:
      throw new Error(`Unknown contract name: ${contractName}`);
  }
}
