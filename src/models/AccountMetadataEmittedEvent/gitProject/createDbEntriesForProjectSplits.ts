import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import AddressDriverSplitReceiverModel, {
  AddressDriverSplitReceiverType,
} from '../../AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../../RepoDriverSplitReceiverModel';
import type { ProjectId } from '../../../common/types';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import { isDependencyOfProjectType } from '../../../utils/assert';

export default async function createDbEntriesForProjectSplits(
  funderProjectId: ProjectId,
  splits: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  requestId: UUID,
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
      { transaction, requestId },
    ),
  );

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isDependencyOfProjectType(dependency)) {
      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
        requestId,
      );
    }

    return AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: dependency.weight,
        accountId: dependency.accountId,
        type: AddressDriverSplitReceiverType.ProjectDependency,
      },
      { transaction, requestId },
    );
  });

  await Promise.all([...maintainerPromises, ...dependencyPromises]);
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
