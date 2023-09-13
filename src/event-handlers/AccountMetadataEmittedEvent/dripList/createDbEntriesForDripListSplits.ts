import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type { DripListId } from '../../../common/types';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import {
  isNftDriverAccountId,
  isDependencyOfProjectType,
} from '../../../utils/assert';
import DripListSplitReceiverModel from '../../../models/DripListSplitReceiverModel';
import {
  AddressDriverSplitReceiverModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import { logRequestDebug } from '../../../utils/logRequest';

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

  const result = await Promise.all([...splitsPromises]);

  logRequestDebug(
    `AccountMetadataEmitted(uint256,bytes32,bytes) was the latest event for Drip List with ID ${funderDripListId}. Created DB entries for its splits:${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
    requestId,
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
}
