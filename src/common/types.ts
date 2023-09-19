import type { Model, Sequelize } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { Drips, NftDriver, RepoDriver } from '../../contracts';
import type {
  DRIPS_CONTRACT_NAMES,
  FORGES_MAP,
  SUPPORTED_NETWORKS,
} from './constants';
import type {
  TypedContractEvent,
  TypedLogDescription,
} from '../../contracts/common';
import type EventHandlerBase from './EventHandlerBase';
import type {
  nftDriverAccountMetadataParser,
  repoDriverAccountMetadataParser,
} from '../metadata/schemas';

export type KnownAny = any;
export type IpfsHash = string & { __brand: 'IpfsHash' };
export type AddressDriverAccountId = string & {
  __brand: 'AddressDriverAccountId';
};
export type NftDriverAccountId = string & { __brand: 'NftDriverAccountId' };
export type DripListId = NftDriverAccountId;
export type RepoDriverAccountId = string & { __brand: 'RepoDriverAccountId' };
export type ProjectId = RepoDriverAccountId;
export type AccountId =
  | AddressDriverAccountId
  | NftDriverAccountId
  | RepoDriverAccountId;

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

export type DbSchema = SupportedNetwork & { __brand: 'dbSchema' };

export type Forge = ValuesOf<typeof FORGES_MAP>;

export type DripsContract = (typeof DRIPS_CONTRACT_NAMES)[number];

export type ChainConfig = {
  [K in DripsContract]: {
    address: AddressLike;
    block: number;
  };
};

// ! DO NOT EXPORT THESE. It will fail in runtime. This is a hack to get the filter types.
const _dripsFilters = ({} as Drips).filters;
const _nftDriverFilters = ({} as NftDriver).filters;
const _repoDriverFilters = ({} as RepoDriver).filters;
const _allFilters = {
  ..._dripsFilters,
  ..._nftDriverFilters,
  ..._repoDriverFilters,
};

export type DripsContractEvent = ValuesOf<typeof _dripsFilters>;
export type NftDriverContractEvent = ValuesOf<typeof _nftDriverFilters>;
export type RepoDriverContractEvent = ValuesOf<typeof _repoDriverFilters>;

type EventSignaturePattern = `${string}(${string})`;

export type DripsEventSignature = {
  [T in keyof typeof _dripsFilters]: T extends string
    ? T extends EventSignaturePattern
      ? T
      : never
    : never;
}[keyof typeof _dripsFilters];

export type NftDriverEventSignature = {
  [T in keyof typeof _nftDriverFilters]: T extends string
    ? T extends EventSignaturePattern
      ? T
      : never
    : never;
}[keyof typeof _nftDriverFilters];

export type RepoDriverEventSignature = {
  [T in keyof typeof _repoDriverFilters]: T extends string
    ? T extends EventSignaturePattern
      ? T
      : never
    : never;
}[keyof typeof _repoDriverFilters];

export type EventSignature =
  | DripsEventSignature
  | NftDriverEventSignature
  | RepoDriverEventSignature;

export type EventSignatureToEventMap = {
  [K in EventSignature]: (typeof _allFilters)[K];
};

export type DripsEvent = ValuesOf<EventSignatureToEventMap>;

export type ExtractOutputObject<T> = T extends TypedContractEvent<
  any,
  infer TOutputTuple,
  any
>
  ? TOutputTuple
  : never;

export type EventArgs<T extends DripsEvent> = TypedLogDescription<T>['args'];

export type EventData<T extends EventSignature> = {
  logIndex: number;
  eventSignature: T;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
  args: EventArgs<EventSignatureToEventMap[T]>;
};

export class HandleRequest<T extends EventSignature> {
  public readonly id: UUID;
  public readonly event: EventData<T>;

  constructor(event: EventData<T>, id: UUID = randomUUID()) {
    this.id = id;
    this.event = event;
  }
}

export type ModelStaticMembers = {
  new (): Model;
  initialize(sequelize: Sequelize): void;
};

export type EventHandlerConstructor<T extends EventSignature> = {
  new (): EventHandlerBase<T>;
};

export interface IEventModel {
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
}

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
