import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import { isDependencyOfProjectType } from '../../../utils/assert';
import type { ProjectId } from '../../../common/types';
import {
  AddressDriverSplitReceiverModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';

export default async function createDbEntriesForProjectSplits(
  funderProjectId: ProjectId,
  splits: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  logs: string[],
  transaction: Transaction,
) {
  await clearCurrentEntries(funderProjectId, transaction);

  const { dependencies, maintainers } = splits;

  const maintainerPromises = maintainers.map((maintainer) =>
    AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: maintainer.weight,
        accountId: maintainer.accountId,
        type: AddressDriverSplitReceiverType.ProjectMaintainer,
      },
      { transaction },
    ),
  );

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isDependencyOfProjectType(dependency)) {
      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
      );
    }

    return AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: dependency.weight,
        accountId: dependency.accountId,
        type: AddressDriverSplitReceiverType.ProjectDependency,
      },
      { transaction },
    );
  });

  const result = await Promise.all([
    ...maintainerPromises,
    ...dependencyPromises,
  ]);

  logs.push(
    `AccountMetadataEmitted(uint256,bytes32,bytes) was the latest event for Git Project with ID ${funderProjectId}. Created DB entries for its splits:
    ${result.map((p) => JSON.stringify(p)).join(`, `)}
    `,
  );
}

async function clearCurrentEntries(
  funderProjectId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
}
