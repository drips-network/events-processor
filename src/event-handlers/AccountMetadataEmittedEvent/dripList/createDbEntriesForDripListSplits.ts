import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type { DripListId } from '../../../common/types';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import DripListSplitReceiverModel from '../../../models/DripListSplitReceiverModel';
import {
  AddressDriverSplitReceiverModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import LogManager from '../../../common/LogManager';
import DripListModel from '../../../models/DripListModel';
import {
  isAddressDriverId,
  isNftDriverId,
  isRepoDiverId,
} from '../../../utils/accountIdUtils';
import { assertDependencyOfProjectType } from '../../../utils/assert';

export default async function createDbEntriesForDripListSplits(
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
