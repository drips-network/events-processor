import type { Transaction } from 'sequelize';
import type {
  DependencyOfProjectType,
  NftDriverId,
  RepoDriverId,
} from '../../core/types';
import { DependencyType } from '../../core/types';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../../models/GitProjectModel';
import { FORGES_MAP } from '../../core/constants';
import unreachableError from '../../utils/unreachableError';
import RepoDriverSplitReceiverModel from '../../models/RepoDriverSplitReceiverModel';

export default async function createDbEntriesForProjectDependency(
  funder:
    | { type: 'project'; accountId: RepoDriverId }
    | { type: 'dripList'; accountId: NftDriverId }
    | { type: 'ecosystem'; accountId: NftDriverId },
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

  let type: DependencyType;
  if (funder.type === 'project') {
    type = DependencyType.ProjectDependency;
  } else if (funder.type === 'dripList') {
    type = DependencyType.DripListDependency;
  } else {
    type = DependencyType.EcosystemDependency;
  }

  return RepoDriverSplitReceiverModel.create(
    {
      weight,
      fundeeProjectId,
      type,
      funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
      funderProjectId: funder.type === 'project' ? funder.accountId : null,
      funderEcosystemId: funder.type === 'ecosystem' ? funder.accountId : null,
      blockTimestamp,
    },
    { transaction },
  );
}
