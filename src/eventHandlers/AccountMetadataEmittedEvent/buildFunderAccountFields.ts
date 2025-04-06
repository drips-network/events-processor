import { DependencyType } from '../../core/types';
import type {
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../../core/types';

export type Funder =
  | {
      type: 'project';
      accountId: RepoDriverId;
      dependencyType: 'dependency' | 'maintainer';
    }
  | { type: 'dripList'; accountId: NftDriverId }
  | { type: 'ecosystem'; accountId: NftDriverId }
  | { type: 'sub-list'; accountId: ImmutableSplitsDriverId };

type FunderKeys = {
  funderProjectId: RepoDriverId | null;
  funderDripListId: NftDriverId | null;
  funderSubListId: ImmutableSplitsDriverId | null;
  funderEcosystemMainAccountId: NftDriverId | null;
};

export default function buildFunderAccountFields(funder: Funder): FunderKeys {
  const keys: FunderKeys = {
    funderProjectId: null,
    funderSubListId: null,
    funderDripListId: null,
    funderEcosystemMainAccountId: null,
  };

  switch (funder.type) {
    case 'project':
      keys.funderProjectId = funder.accountId;
      break;
    case 'sub-list':
      keys.funderSubListId = funder.accountId;
      break;
    case 'dripList':
      keys.funderDripListId = funder.accountId;
      break;
    case 'ecosystem':
      keys.funderEcosystemMainAccountId = funder.accountId;
      break;
    default:
      throw new Error(`Unhandled funder type '${(funder as any).type}'.`);
  }

  return keys;
}

// TODO: Remove this function when the type is removed from the codebase.
export const resolveDependencyType = (funder: Funder): DependencyType => {
  if (funder.type === 'project') {
    return DependencyType.ProjectDependency;
  }

  if (funder.type === 'dripList') {
    return DependencyType.DripListDependency;
  }

  // TODO: At the moment, both `ecosystem` and `sub-list` are treated as EcosystemDependency. The type is scheduled for removal soon.
  return DependencyType.EcosystemDependency;
};
