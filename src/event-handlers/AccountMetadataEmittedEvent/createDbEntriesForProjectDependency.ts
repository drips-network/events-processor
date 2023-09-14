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
import RepoDriverSplitReceiverModel, {
  RepoDriverSplitReceiverType,
} from '../../models/RepoDriverSplitReceiverModel';
import { isNftDriverAccountId, isRepoDiverAccountId } from '../../utils/assert';

export default async function createDbEntriesForProjectDependency(
  funderAccountId: ProjectId | DripListId,
  projectDependency: DependencyOfProjectType,
  transaction: Transaction,
) {
  const {
    weight,
    accountId: fundeeProjectId,
    source: { forge, ownerName, repoName, url },
  } = projectDependency;

  await GitProjectModel.findOrCreate({
    lock: true,
    transaction,
    where: {
      id: fundeeProjectId,
    },
    defaults: {
      url,
      splitsJson: null,
      id: fundeeProjectId,
      name: `${ownerName}/${repoName}`,
      verificationStatus: ProjectVerificationStatus.Unclaimed,
      forge:
        Object.values(FORGES_MAP).find(
          (f) => f.toLocaleLowerCase() === forge.toLowerCase(),
        ) ?? shouldNeverHappen(),
    },
  });

  await RepoDriverSplitReceiverModel.create(
    {
      weight,
      fundeeProjectId,
      type: isNftDriverAccountId(funderAccountId)
        ? RepoDriverSplitReceiverType.DripListDependency
        : RepoDriverSplitReceiverType.ProjectDependency,
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
