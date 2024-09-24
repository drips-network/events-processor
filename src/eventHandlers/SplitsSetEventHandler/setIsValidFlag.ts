import type { DripListId, RepoDriverId } from '../../core/types';
import type { SplitsSetEventModel } from '../../models';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../../models';
import { isNftDriverId, isRepoDriverId } from '../../utils/accountIdUtils';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import unreachableError from '../../utils/unreachableError';
import type LogManager from '../../core/LogManager';
import { formatSplitReceivers } from '../AccountMetadataEmittedEvent/splitsValidator';
import { dripsContract } from '../../core/contractClients';

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
    const dripList = await DripListModel.findByPk(accountId, {
      lock: true,
    });

    if (!dripList) {
      throw new Error(
        `Failed to set 'isValid' flag for Drip List with ID '${accountId}': Drip List not found.
        \r Possible reasons:
        \r\t - The event that should have created the Drip List was not processed yet.
        \r\t - The event was emitted as a result of a manual 'SetSplits' transaction that for a Drip List that does not exist in the app.`,
      );
    }

    const storedInDbFromMetaReceiversHash = await dripsContract.hashSplits(
      formatSplitReceivers(await getDripListDbReceivers(accountId)),
    );

    // If we reach this point, it means that `receiversHash` is the latest on-chain hash.

    if (receiversHash !== storedInDbFromMetaReceiversHash) {
      dripList.isValid = false;

      logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

      await dripList.save();

      // We need to throw so that the job is retried...
      throw new Error(
        `Splits receivers hashes do not match for Drip List with ID '${accountId}':
        \r\t - On-chain splits hash:                     ${onChainSplitsHash}
        \r\t - 'SetSplits' event splits hash:            ${receiversHash}
        \r\t - DB (populated from metadata) splits hash: ${storedInDbFromMetaReceiversHash}
        \r Possible reasons:
        \r\t - The 'AccountMetadataEmitted' event that should have created the Drip List splits was not processed yet.
        \r\t - The 'SetSplits' event (was manually emitted?) had splits that do not match what's already stored in the DB (from metadata).`,
      );
    } else if (dripList.isValid === false) {
      dripList.isValid = true;

      logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

      await dripList.save();
    }
  } else {
    logManager.appendLog(
      `Skipping 'isValid' flag update for account with ID '${accountId}' because it's not a Project or a Drip List.`,
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

async function getDripListDbReceivers(accountId: DripListId) {
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
