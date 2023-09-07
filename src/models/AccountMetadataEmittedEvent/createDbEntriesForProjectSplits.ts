import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import AddressDriverSplitReceiverModel, {
  AddressDriverSplitReceiverType,
} from '../AddressDriverSplitReceiverModel';
import RepoDriverSplitReceiverModel from '../RepoDriverSplitReceiverModel';
import { FORGES_MAP } from '../../common/constants';
import shouldNeverHappen from '../../utils/shouldNeverHappen';
import type { KnownAny, ProjectId } from '../../common/types';
import type { DependencyOfProjectType } from './isDependencyOfProjectType';
import isDependencyOfProjectType from './isDependencyOfProjectType';
import GitProjectModel, { ProjectVerificationStatus } from '../GitProjectModel';

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
        type: AddressDriverSplitReceiverType.Maintainer,
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
        type: AddressDriverSplitReceiverType.Dependency,
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

async function createDbEntriesForProjectDependency(
  funderProjectId: ProjectId,
  projectDependency: DependencyOfProjectType,
  transaction: Transaction,
  requestId: UUID,
) {
  const {
    weight,
    accountId: selfProjectId,
    source: { forge, ownerName, repoName, url },
  } = projectDependency;

  await GitProjectModel.findOrCreate({
    requestId,
    transaction,
    where: {
      id: selfProjectId,
    },
    defaults: {
      url,
      id: selfProjectId,
      name: `${ownerName}/${repoName}`,
      verificationStatus: ProjectVerificationStatus.Unclaimed,
      forge:
        Object.values(FORGES_MAP).find(
          (f) => f.toLocaleLowerCase() === forge.toLowerCase(),
        ) ?? shouldNeverHappen(),
    },
  } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.

  return RepoDriverSplitReceiverModel.create(
    {
      weight,
      selfProjectId,
      funderProjectId,
    },
    { transaction, requestId } as KnownAny, // `as any` to avoid TS complaining about passing in the `requestId`.
  );
}
