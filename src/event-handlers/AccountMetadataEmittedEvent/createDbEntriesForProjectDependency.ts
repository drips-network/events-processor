import type { Transaction } from 'sequelize';
import type {
  DependencyOfProjectType,
  DripListId,
  ProjectId,
} from '../../common/types';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../../models/GitProjectModel';
import { FORGES_MAP } from '../../common/constants';
import shouldNeverHappen from '../../utils/shouldNeverHappen';
import RepoDriverSplitReceiverModel from '../../models/RepoDriverSplitReceiverModel';
import { isNftDriverAccountId, isRepoDiverAccountId } from '../../utils/assert';

export default async function createDbEntriesForProjectDependency(
  funderAccountId: ProjectId | DripListId,
  projectDependency: DependencyOfProjectType,
  transaction: Transaction,
) {
  const {
    weight,
    accountId: selfProjectId,
    source: { forge, ownerName, repoName, url },
  } = projectDependency;

  await GitProjectModel.findOrCreate({
    lock: true,
    transaction,
    where: {
      id: selfProjectId,
    },
    defaults: {
      url,
      splitsJson: null,
      id: selfProjectId,
      name: `${ownerName}/${repoName}`,
      verificationStatus: ProjectVerificationStatus.Unclaimed,
      forge:
        Object.values(FORGES_MAP).find(
          (f) => f.toLocaleLowerCase() === forge.toLowerCase(),
        ) ?? shouldNeverHappen(),
    },
  });

  return RepoDriverSplitReceiverModel.create(
    {
      weight,
      selfProjectId,
      funderDripListId: isNftDriverAccountId(funderAccountId)
        ? funderAccountId
        : null,
      funderProjectId: isRepoDiverAccountId(funderAccountId)
        ? funderAccountId
        : null,
    },
    { transaction },
  );
}
