import type { Transaction } from 'sequelize';
import type {
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../../core/types';
import type { SplitsSetEventModel } from '../../models';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  EcosystemMainAccountModel,
  ProjectModel,
  RepoDriverSplitReceiverModel,
  SubListModel,
  SubListSplitReceiverModel,
} from '../../models';
import {
  isImmutableSplitsDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../utils/accountIdUtils';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import unreachableError from '../../utils/unreachableError';
import { dripsContract } from '../../core/contractClients';
import type LogManager from '../../core/LogManager';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import RecoverableError from '../../utils/recoverableError';

export default async function setIsValidFlag(
  splitsSetEvent: SplitsSetEventModel,
  logManager: LogManager,
  transaction: Transaction,
): Promise<void> {
  const { accountId, receiversHash } = splitsSetEvent;
  const onChainSplitsHash = await dripsContract.splitsHash(accountId);

  // Only try to set the 'isValid' flag if this is the latest event.
  if (receiversHash !== onChainSplitsHash) {
    return;
  }

  if (isRepoDriverId(accountId)) {
    const project = await ProjectModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!project) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for Project: Project '${accountId}' not found.`,
      );
    }

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(await getProjectDbReceivers(accountId, transaction)),
    );

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      project.isValid = false;

      logManager.appendUpdateLog(project, ProjectModel, project.id);

      await project.save({ transaction });

      throw new RecoverableError(
        `Failed to set 'isValid' for Project '${accountId}': mismatch between on-chain, event, and DB splits receiver hashes (on-chain: ${onChainSplitsHash}, event: ${receiversHash}, db: ${storedInDbFromMetaReceiversHash}).`,
      );
    } else if (project.isValid === false) {
      project.isValid = true;

      logManager.appendUpdateLog(project, ProjectModel, project.id);

      await project.save({ transaction });
    }
  } else if (isNftDriverId(accountId)) {
    const dripList = await DripListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const ecosystem = await EcosystemMainAccountModel.findByPk(accountId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    const entity = (dripList ?? ecosystem)!;
    const entityModel = dripList ? DripListModel : EcosystemMainAccountModel;

    if (!dripList && !ecosystem) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for ${entityModel.name}: ${entityModel.name} '${accountId}' not found.`,
      );
    }

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(
        entityModel.name === 'DripListModel'
          ? await getDripListDbReceivers(accountId, transaction)
          : await getEcosystemDbReceivers(accountId, transaction),
      ),
    );

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      entity.isValid = false;

      logManager.appendUpdateLog(entity, entityModel, entity.id);

      await entity.save({ transaction });

      throw new RecoverableError(
        `Failed to set 'isValid' for ${dripList ? 'Drip List' : 'Ecosystem Main Identity'} '${accountId}': mismatch between on-chain, event, and DB splits receiver hashes (on-chain: ${onChainSplitsHash}, event: ${receiversHash}, db: ${storedInDbFromMetaReceiversHash}).`,
      );
    } else if (entity.isValid === false) {
      entity.isValid = true;

      logManager.appendUpdateLog(entity, entityModel, entity.id);

      await entity.save({ transaction });
    }
  } else if (isImmutableSplitsDriverId(accountId)) {
    const subList = await SubListModel.findByPk(accountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!subList) {
      throw new RecoverableError(
        `Failed to set 'isValid' flag for Sub List: Sub List '${accountId}' not found.`,
      );
    }

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(await getSubListDbReceivers(accountId, transaction)),
    );

    // If we reach this point, it means that `receiversHash` is the latest on-chain hash.

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      subList.isValid = false;

      logManager.appendUpdateLog(subList, SubListModel, subList.id);

      await subList.save({ transaction });

      throw new RecoverableError(
        `Failed to set 'isValid' for Sub List '${accountId}': mismatch between on-chain, event, and DB splits receiver hashes (on-chain: ${onChainSplitsHash}, event: ${receiversHash}, db: ${storedInDbFromMetaReceiversHash}).`,
      );
    } else if (subList.isValid === false) {
      subList.isValid = true;

      logManager.appendUpdateLog(subList, SubListModel, subList.id);

      await subList.save({ transaction });
    }
  }
}

async function getProjectDbReceivers(
  accountId: RepoDriverId,
  transaction: Transaction,
) {
  const addressReceivers: SplitsReceiverStruct[] =
    await AddressDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderProjectId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeAccountId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const projectReceivers: SplitsReceiverStruct[] =
    await RepoDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderProjectId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeProjectId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const dripListReceivers: SplitsReceiverStruct[] =
    await DripListSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderProjectId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeDripListId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  return [...addressReceivers, ...projectReceivers, ...dripListReceivers];
}

async function getDripListDbReceivers(
  accountId: NftDriverId,
  transaction: Transaction,
) {
  const addressReceivers: SplitsReceiverStruct[] =
    await AddressDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderDripListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeAccountId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const projectReceivers: SplitsReceiverStruct[] =
    await RepoDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderDripListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeProjectId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const dripListReceivers: SplitsReceiverStruct[] =
    await DripListSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderDripListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeDripListId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  return [...addressReceivers, ...projectReceivers, ...dripListReceivers];
}

async function getEcosystemDbReceivers(
  accountId: NftDriverId,
  transaction: Transaction,
) {
  const projectReceivers: SplitsReceiverStruct[] =
    await RepoDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderEcosystemMainAccountId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeProjectId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const subListReceivers: SplitsReceiverStruct[] =
    await SubListSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderEcosystemMainAccountId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeSubListId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  return [...projectReceivers, ...subListReceivers];
}

async function getSubListDbReceivers(
  accountId: ImmutableSplitsDriverId,
  transaction: Transaction,
) {
  const addressReceivers: SplitsReceiverStruct[] =
    await AddressDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderSubListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeAccountId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const projectReceivers: SplitsReceiverStruct[] =
    await RepoDriverSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderSubListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeProjectId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const dripListReceivers: SplitsReceiverStruct[] =
    await DripListSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderSubListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeDripListId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const subListReceivers: SplitsReceiverStruct[] =
    await SubListSplitReceiverModel.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      where: {
        funderSubListId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeSubListId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  return [
    ...projectReceivers,
    ...subListReceivers,
    ...dripListReceivers,
    ...addressReceivers,
  ];
}
