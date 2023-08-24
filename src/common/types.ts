import type { ModelAttributes, Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { type Drips, type RepoDriver } from '../../contracts';
import type { SUPPORTED_CONTRACTS, SUPPORTED_NETWORKS } from './constants';
import type { TypedContractEvent, TypedEventLog } from '../../contracts/common';

// TODO: add support for other contracts.

export type UUID = string;
export type Address = string;
export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[keyof T];
export type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: {
        message: string;
        [key: string]: any;
      };
    };

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];
export type DbSchema = SupportedNetwork;

export type SupportedContractName = (typeof SUPPORTED_CONTRACTS)[number];
export type SupportedContract = Drips | RepoDriver;

export type ChainConfig = {
  [K in SupportedContractName]: {
    address: Address;
    block: number;
  };
};

type ExtractTypeChainOutputTuple<T> = T extends TypedContractEvent<
  any,
  infer OT,
  any
>
  ? OT
  : never;

// ! IMPORTANT: Do not export these filters. This is a hack to get the types.
const _dripsFilters = ({} as Drips).filters;
const _repoDriverFilters = ({} as RepoDriver).filters;
const _allFilters = { ..._dripsFilters, ..._repoDriverFilters };

export type DripsEvent = ValuesOf<typeof _dripsFilters>;
export type DripsEventOutputTuple = ExtractTypeChainOutputTuple<DripsEvent>;

export type RepoDriverEvent = ValuesOf<typeof _repoDriverFilters>;
export type RepoDriverEventOutputTuple =
  ExtractTypeChainOutputTuple<RepoDriverEvent>;

type SupportedFilterSignaturePattern = `${string}(${string})`;

export type SupportedDripsFilterSignature = {
  [T in KeysOf<typeof _dripsFilters>]: T extends string
    ? T extends SupportedFilterSignaturePattern
      ? T
      : never
    : never;
}[keyof typeof _dripsFilters];

export type SupportedRepoDriverFilterSignature = {
  [T in KeysOf<typeof _repoDriverFilters>]: T extends string
    ? T extends SupportedFilterSignaturePattern
      ? T
      : never
    : never;
}[keyof typeof _repoDriverFilters];

export type SupportedFilterSignature =
  | SupportedDripsFilterSignature
  | SupportedRepoDriverFilterSignature;

type Filter = typeof _allFilters;
export type SupportedFilter = {
  [K in SupportedFilterSignature]: Filter[K];
};

export type SupportedEvent = ValuesOf<SupportedFilter>;
export type SupportedOutputTuple = ExtractTypeChainOutputTuple<SupportedEvent>;

export type KeysToModelAttributes<T extends keyof ModelAttributes> = {
  [K in T]: ModelAttributes[K];
};

export class HandleRequest<T extends SupportedFilterSignature> {
  public readonly id: UUID;
  public readonly correlationId: UUID | null = null;

  public readonly eventLog: TypedEventLog<SupportedFilter[T]>;

  constructor(
    eventLog: TypedEventLog<SupportedFilter[T]>,
    correlationId: UUID | null = null,
  ) {
    this.id = uuidv4();
    this.eventLog = eventLog;
    this.correlationId = correlationId;
  }
}

export interface ModelCtor {
  new (): Model;
  initialize(): void;
}

export interface IEventModel {
  readonly rawEvent: string;
  readonly logIndex: number;
  readonly blockNumber: number;
  readonly blockTimestamp: Date;
  readonly transactionHash: string;
}
