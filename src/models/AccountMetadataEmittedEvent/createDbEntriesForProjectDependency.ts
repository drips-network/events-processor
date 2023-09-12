import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type {
  DependencyOfProjectType,
  DripListId,
  KnownAny,
  ProjectId,
} from '../../common/types';
import GitProjectModel, { ProjectVerificationStatus } from '../GitProjectModel';
import { FORGES_MAP } from '../../common/constants';
import shouldNeverHappen from '../../utils/shouldNeverHappen';
import RepoDriverSplitReceiverModel from '../RepoDriverSplitReceiverModel';
import { isNftDriverAccountId, isProjectId } from '../../utils/assert';

export default async function createDbEntriesForProjectDependency(
  funderAccountId: ProjectId | DripListId,
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
      funderDripListId: isNftDriverAccountId(funderAccountId)
        ? funderAccountId
        : null,
      funderProjectId: isProjectId(funderAccountId) ? funderAccountId : null,
    },
    { transaction, requestId } as KnownAny, // `as any` to avoid TS complaining about passing in the `requestId`.
  );
}
