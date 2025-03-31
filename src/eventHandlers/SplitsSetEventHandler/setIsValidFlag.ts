import type { NftDriverId, RepoDriverId } from '../../core/types';
import type { SplitsSetEventModel } from '../../models';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  EcosystemModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
  SubListSplitReceiverModel,
} from '../../models';
import { isNftDriverId, isRepoDriverId } from '../../utils/accountIdUtils';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import unreachableError from '../../utils/unreachableError';
import { dripsContract } from '../../core/contractClients';
import type LogManager from '../../core/LogManager';
import { formatSplitReceivers } from '../AccountMetadataEmittedEvent/splitsValidator';

export default async function setIsValidFlag(
  splitsSetEvent: SplitsSetEventModel,
  logManager: LogManager,
): Promise<void> {
  const { accountId, receiversHash } = splitsSetEvent;
  const onChainSplitsHash = await dripsContract.splitsHash(accountId);

  // Only if the `SplitsSet` event is the latest event (on-chain), we validate the splits.
  if (receiversHash !== onChainSplitsHash) {
    return;
  }

  // Here, we know that the `SplitsSet` event is the latest event (on-chain).

  if (isRepoDriverId(accountId)) {
    const project = await GitProjectModel.findByPk(accountId, {
      lock: true,
    });

    if (!project) {
      throw new Error(
        `Failed to set 'isValid' flag for Project with ID '${accountId}': Project not found.
        \r Possible reasons:
        \r\t - The event that should have created the Project was not processed yet.
        \r\t - The event was emitted as a result of a manual 'SetSplits' transaction that for a Project that does not exist in the app.`,
      );
    }

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(await getProjectDbReceivers(accountId)),
    );

    // If we reach this point, it means that `receiversHash` is the latest on-chain hash.

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      project.isValid = false;

      logManager.appendUpdateLog(project, GitProjectModel, project.id);

      await project.save();

      // We need to throw so that the job is retried...
      throw new Error(
        `Splits receivers hashes do not match for Project with ID '${accountId}':
        \r\t - On-chain splits hash:                     ${onChainSplitsHash}
        \r\t - 'SetSplits' event splits hash:            ${receiversHash}
        \r\t - DB (populated from metadata) splits hash: ${storedInDbFromMetaReceiversHash}
        \r Possible reasons:
        \r\t - The 'AccountMetadataEmitted' event that should have created the Project splits was not processed yet.
        \r\t - The 'SetSplits' event (was manually emitted?) had splits that do not match what's already stored in the DB (from metadata).`,
      );
    } else if (project.isValid === false) {
      project.isValid = true;

      logManager.appendUpdateLog(project, GitProjectModel, project.id);

      await project.save();
    }
  } else if (isNftDriverId(accountId)) {
    const [dripList, ecosystem] = await Promise.all([
      DripListModel.findByPk(accountId, {
        lock: true,
      }),
      EcosystemModel.findByPk(accountId, {
        lock: true,
      }),
    ]);

    if (!dripList && !ecosystem) {
      throw new Error(
        `Failed to set 'isValid' flag for account with ID '${accountId}': Account not found.
        \r Possible reasons:
        \r\t - The event that should have created the Account was not processed yet.
        \r\t - The event was emitted as a result of a manual 'SetSplits' transaction that for an Account that does not exist in the app.`,
      );
    }

    const entity = (dripList ?? ecosystem)!;
    const entityModel = dripList ? DripListModel : EcosystemModel;

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(
        entityModel.name === 'DripListModel'
          ? await getDripListDbReceivers(accountId)
          : await getEcosystemDbReceivers(accountId),
      ),
    );

    // If we reach this point, it means that `receiversHash` is the latest on-chain hash.

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      entity.isValid = false;

      logManager.appendUpdateLog(entity, entityModel, entity.id);

      await entity.save();

      // We need to throw so that the job is retried...
      throw new Error(
        `Splits receivers hashes do not match for ${entityModel.name} with ID '${accountId}':
        \r\t - On-chain splits hash:                     ${onChainSplitsHash}
        \r\t - 'SetSplits' event splits hash:            ${receiversHash}
        \r\t - DB (populated from metadata) splits hash: ${storedInDbFromMetaReceiversHash}
        \r Possible reasons:
        \r\t - The 'AccountMetadataEmitted' event that should have created the Drip List splits was not processed yet.
        \r\t - The 'SetSplits' event (was manually emitted?) had splits that do not match what's already stored in the DB (from metadata).`,
      );
    } else if (entity.isValid === false) {
      entity.isValid = true;

      logManager.appendUpdateLog(entity, entityModel, entity.id);

      await entity.save();
    }
  } else {
    logManager.appendLog(
      `Skipping 'isValid' flag update for account with ID '${accountId}' because it's not a Project, Drip List, or Ecosystem.`,
    );
  }
}

async function getProjectDbReceivers(accountId: RepoDriverId) {
  const addressReceivers: SplitsReceiverStruct[] =
    await AddressDriverSplitReceiverModel.findAll({
      lock: true,

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
      lock: true,

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
      lock: true,
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

async function getDripListDbReceivers(accountId: NftDriverId) {
  const addressReceivers: SplitsReceiverStruct[] =
    await AddressDriverSplitReceiverModel.findAll({
      lock: true,

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
      lock: true,

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
      lock: true,

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

async function getEcosystemDbReceivers(accountId: NftDriverId) {
  const projectReceivers: SplitsReceiverStruct[] =
    await RepoDriverSplitReceiverModel.findAll({
      lock: true,

      where: {
        funderEcosystemId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeProjectId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  const subListReceivers: SplitsReceiverStruct[] =
    await SubListSplitReceiverModel.findAll({
      lock: true,
      where: {
        funderEcosystemId: accountId,
      },
    }).then((receivers) =>
      receivers.map((receiver) => ({
        accountId: receiver.fundeeImmutableSplitsId ?? unreachableError(),
        weight: receiver.weight,
      })),
    );

  return [...projectReceivers, ...subListReceivers];
}
