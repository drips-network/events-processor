import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Model, Sequelize } from 'sequelize';
import type {
  nftDriverAccountMetadataParser,
  repoDriverAccountMetadataParser,
} from '../metadata/schemas';
import type {
  DRIPS_CONTRACTS,
  FORGES_MAP,
  SUPPORTED_NETWORKS,
} from './constants';

export type KnownAny = any;

export type IpfsHash = string & { __brand: 'IpfsHash' };

export type AddressDriverId = string & {
  __brand: 'AddressDriverId';
};

export type NftDriverId = string & { __brand: 'NftDriverId' };
export type DripListId = NftDriverId;
export type RepoDriverId = string & { __brand: 'RepoDriverId' };
export type ProjectId = RepoDriverId;
export type ImmutableSplitsDriverId = string & {
  __brand: 'ImmutableSplitsDriverId';
};
export type AccountId =
  | AddressDriverId
  | NftDriverId
  | RepoDriverId
  | ImmutableSplitsDriverId;

export type Address = string & { __brand: 'Address' };

export type BigIntString = string & { __brand: 'BigIntString' };

export type ValuesOf<T> = T[keyof T];

export type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: unknown;
    };

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export type DbSchema = SupportedNetwork & { __brand: 'DbSchema' };

export type Forge = ValuesOf<typeof FORGES_MAP>;

export type DripsContract = (typeof DRIPS_CONTRACTS)[number];

export type ChainConfig = {
  block: number;
  contracts: {
    [K in DripsContract]: {
      address: string;
    };
  };
};

export type ModelStaticMembers = {
  new (): Model;
  initialize(sequelize: Sequelize): void;
};

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Dependency = ArrayElement<
  | AnyVersion<typeof repoDriverAccountMetadataParser>['splits']['dependencies']
  | AnyVersion<typeof nftDriverAccountMetadataParser>['projects']
>;

export type DependencyOfProjectType = {
  type: 'repoDriver';
  accountId: ProjectId;
  source: {
    forge: 'github';
    repoName: string;
    ownerName: string;
    url: string;
  };
  weight: number;
};

export enum DependencyType {
  ProjectDependency = 'ProjectDependency',
  DripListDependency = 'DripListDependency',
}

export type StreamHistoryHashes = string & {
  __type: 'StreamHistoryHashes';
};
