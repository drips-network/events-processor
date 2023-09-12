import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import AddressDriverSplitReceiverModel, {
  AddressDriverSplitReceiverType,
} from '../../AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../../RepoDriverSplitReceiverModel';
import type { DripListId } from '../../../common/types';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import DripListSplitReceiverModel from '../../DripListSplitReceiverModel';
import {
  isNftDriverAccountId,
  isDependencyOfProjectType,
} from '../../../utils/assert';

export default async function createDbEntriesForDripListSplits(
  funderDripListId: DripListId,
  projects: AnyVersion<typeof nftDriverAccountMetadataParser>['projects'],
  requestId: UUID,
  transaction: Transaction,
) {
  await clearCurrentEntries(funderDripListId, transaction);

  const splitsPromises = projects.map(async (project) => {
    if (isDependencyOfProjectType(project)) {
      return createDbEntriesForProjectDependency(
        funderDripListId,
        project,
        transaction,
        requestId,
      );
    }

    if (isNftDriverAccountId(project.accountId)) {
      DripListSplitReceiverModel.create(
        {
          funderDripListId,
          accountId: project.accountId,
          weight: project.weight,
        },
        { transaction, requestId },
      );
    }

    return AddressDriverSplitReceiverModel.create(
      {
        funderDripListId,
        weight: project.weight,
        accountId: project.accountId,
        type: AddressDriverSplitReceiverType.DripListDependency,
      },
      { transaction, requestId },
    );
  });

  await Promise.all([...splitsPromises]);
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
}
