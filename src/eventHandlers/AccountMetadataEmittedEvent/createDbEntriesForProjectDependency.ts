import type { Transaction } from 'sequelize';
import {
  DependencyType,
  type DependencyOfProjectType,
  type DripListId,
  type ProjectId,
} from '../../core/types';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../../models/GitProjectModel';
import { FORGES_MAP } from '../../core/constants';
import unreachableError from '../../utils/unreachableError';
import RepoDriverSplitReceiverModel from '../../models/RepoDriverSplitReceiverModel';
import { isNftDriverId, isRepoDriverId } from '../../utils/accountIdUtils';

export default async function createDbEntriesForProjectDependency(
  funderAccountId: ProjectId | DripListId,
  projectDependency: DependencyOfProjectType,
  transaction: Transaction,
  blockTimestamp: Date,
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
      isVisible: true, // During creation, the project is visible by default. Account metadata will set the final visibility.
      isValid: true, // There are no receivers yet, so the project is valid.
      id: fundeeProjectId,
      name: `${ownerName}/${repoName}`,
      verificationStatus: ProjectVerificationStatus.Unclaimed,
      forge:
        Object.values(FORGES_MAP).find(
          (f) => f.toLocaleLowerCase() === forge.toLowerCase(),
        ) ?? unreachableError(),
    },
  });

  return RepoDriverSplitReceiverModel.create(
    {
      weight,
      fundeeProjectId,
      type: isNftDriverId(funderAccountId)
        ? DependencyType.DripListDependency
        : DependencyType.ProjectDependency,
      funderDripListId: isNftDriverId(funderAccountId) ? funderAccountId : null,
      funderProjectId: isRepoDriverId(funderAccountId) ? funderAccountId : null,
      blockTimestamp,
    },
    { transaction },
  );
}
