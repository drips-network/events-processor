/* eslint-disable no-param-reassign */
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { DripListId, IpfsHash } from '../../../common/types';
import DripListModel from '../../../models/DripListModel';
import getNftDriverMetadata from '../../../utils/metadataUtils';
import validateDripListMetadata from './validateDripListMetadata';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../common/LogManager';
import {
  isAddressDriverId,
  isNftDriverId,
  isRepoDiverId,
} from '../../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import DripListSplitReceiverModel from '../../../models/DripListSplitReceiverModel';
import {
  AddressDriverSplitReceiverModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import areReceiversValid from '../splitsValidator';

export default async function handleDripListMetadata(
  logManager: LogManager,
  dripListId: DripListId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
) {
  const dripList = await DripListModel.findByPk(dripListId, {
    transaction,
    lock: true,
  });

  if (!dripList) {
    throw new Error(
      `Failed to update the metadata of Drip List with ID ${dripListId}: the list does not exist in the database. 
      This is normal if the event that should have created the project was not processed yet.`,
    );
  }

  const metadata = await getNftDriverMetadata(ipfsHash);

  await validateDripListMetadata(dripList, metadata);

  await updateDripListMetadata(dripList, logManager, transaction, metadata);

  await createDbEntriesForDripListSplits(
    dripListId,
    metadata.projects,
    logManager,
    transaction,
  );
}

async function updateDripListMetadata(
  dripList: DripListModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): Promise<void> {
  const { name, projects } = metadata;

  dripList.name = name ?? null;
  dripList.projectsJson = JSON.stringify(projects);

  const isValid = await areReceiversValid(
    dripList.id,
    metadata.projects.map((s) => ({
      weight: s.weight,
      accountId: s.accountId,
    })),
  );

  dripList.isValid = isValid;

  if (!isValid) {
    logManager.appendLog(
      `Set the Drip List to 'invalid' because the hash of the metadata receivers did not match the hash of the on-chain receivers for project with ID ${dripList.id}. 
      This means that the processed event was the latest in the database but not the latest on-chain. 
      Check the 'isValid' flag to see if the project is valid after all the events are processed.`,
    );
  }

  logManager.appendUpdateLog(dripList, DripListModel, dripList.id);

  await dripList.save({ transaction });
}

async function createDbEntriesForDripListSplits(
  funderDripListId: DripListId,
  projects: AnyVersion<typeof nftDriverAccountMetadataParser>['projects'],
  logManager: LogManager,
  transaction: Transaction,
) {
  await clearCurrentEntries(funderDripListId, transaction);

  const splitsPromises = projects.map((project) => {
    if (isRepoDiverId(project.accountId)) {
      assertDependencyOfProjectType(project);

      return createDbEntriesForProjectDependency(
        funderDripListId,
        project,
        transaction,
      );
    }

    if (isNftDriverId(project.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderDripListId,
          fundeeDripListId: project.accountId,
          weight: project.weight,
        },
        { transaction },
      );
    }

    if (isAddressDriverId(project.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderDripListId,
          weight: project.weight,
          fundeeAccountId: project.accountId,
          type: AddressDriverSplitReceiverType.DripListDependency,
        },
        { transaction },
      );
    }

    return shouldNeverHappen(
      `Split with account ID ${project.accountId} is not an Address, Drip List, or a Git Project.`,
    );
  });

  const result = await Promise.all([...splitsPromises]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      DripListModel,
    )} with ID ${funderDripListId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

async function clearCurrentEntries(
  funderDripListId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
  await DripListSplitReceiverModel.destroy({
    where: {
      funderDripListId,
    },
    transaction,
  });
}
