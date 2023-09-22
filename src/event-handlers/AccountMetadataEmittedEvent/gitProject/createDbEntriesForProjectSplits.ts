import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import type { ProjectId } from '../../../common/types';
import {
  AddressDriverSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import LogManager from '../../../common/LogManager';
import {
  assertAddressDiverId,
  isAddressDriverId,
  isRepoDiverId,
} from '../../../utils/accountIdUtils';

export default async function createDbEntriesForProjectSplits(
  funderProjectId: ProjectId,
  splits: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  logManager: LogManager,
  transaction: Transaction,
) {
  await clearCurrentEntries(funderProjectId, transaction);

  const { dependencies, maintainers } = splits;

  const maintainerPromises = maintainers.map((maintainer) => {
    assertAddressDiverId(maintainer.accountId);

    return AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: maintainer.weight,
        fundeeAccountId: maintainer.accountId,
        type: AddressDriverSplitReceiverType.ProjectMaintainer,
      },
      { transaction },
    );
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDiverId(dependency.accountId)) {
      assertDependencyOfProjectType(dependency);

      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
      );
    }

    if (isAddressDriverId(dependency.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderProjectId,
          weight: dependency.weight,
          fundeeAccountId: dependency.accountId,
          type: AddressDriverSplitReceiverType.ProjectDependency,
        },
        { transaction },
      );
    }

    return shouldNeverHappen(
      `Dependency with account ID ${dependency.accountId} is not an Address nor a Git Project.`,
    );
  });

  const result = await Promise.all([
    ...maintainerPromises,
    ...dependencyPromises,
  ]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      GitProjectModel,
    )} with ID ${funderProjectId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
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
