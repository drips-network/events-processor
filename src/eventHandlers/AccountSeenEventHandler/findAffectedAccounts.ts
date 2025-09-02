import type { Transaction } from 'sequelize';
import SplitsReceiverModel from '../../models/SplitsReceiverModel';
import ProjectModel from '../../models/ProjectModel';
import DripListModel from '../../models/DripListModel';
import SubListModel from '../../models/SubListModel';
import EcosystemMainAccountModel from '../../models/EcosystemMainAccountModel';
import LinkedIdentityModel from '../../models/LinkedIdentityModel';
import type { AccountId } from '../../core/types';

export interface AffectedAccount {
  accountId: AccountId;
  type:
    | 'Project'
    | 'DripList'
    | 'SubList'
    | 'EcosystemMainAccount'
    | 'LinkedIdentity';
}

/**
 * Finds all accounts that have splits pointing to the specified deadline account.
 * These accounts may need their isValid/isLinked flags recalculated when the deadline account becomes "seen".
 */
export async function findAffectedAccounts(
  deadlineAccountId: AccountId,
  transaction: Transaction,
): Promise<AffectedAccount[]> {
  const splitsReceivers = await SplitsReceiverModel.findAll({
    where: {
      receiverAccountId: deadlineAccountId,
    },
    attributes: ['senderAccountId'],
    transaction,
  });

  const affectedAccountIds = [
    ...new Set(splitsReceivers.map((receiver) => receiver.senderAccountId)),
  ];

  const affectedAccounts: AffectedAccount[] = [];

  for (const accountId of affectedAccountIds) {
    const project = await ProjectModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const dripList = await DripListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const subList = await SubListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const ecosystemMainAccount = await EcosystemMainAccountModel.findByPk(
      accountId,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      },
    );

    const linkedIdentity = await LinkedIdentityModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const foundEntities = [
      project && 'Project',
      dripList && 'DripList',
      subList && 'SubList',
      ecosystemMainAccount && 'EcosystemMainAccount',
      linkedIdentity && 'LinkedIdentity',
    ].filter(Boolean);

    if (foundEntities.length > 1) {
      throw new Error(
        `CRITICAL BUG: Account ${accountId} exists in multiple entity tables: ${foundEntities.join(', ')}`,
      );
    }

    if (foundEntities.length === 1) {
      affectedAccounts.push({
        accountId,
        type: foundEntities[0] as AffectedAccount['type'],
      });
    }
  }

  return affectedAccounts;
}
