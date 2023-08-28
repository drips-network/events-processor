import type { Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import type { Drips, RepoDriver } from '../../contracts';
import type { DRIPS_CONTRACT_NAMES, SUPPORTED_NETWORKS } from './constants';
import type { TypedContractEvent, TypedEventLog } from '../../contracts/common';
import type EventHandlerBase from './EventHandlerBase';

export type IpfsHash = string;

export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[KeysOf<T>];

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

export type DripsContract = (typeof DRIPS_CONTRACT_NAMES)[number];

export type ChainConfig = {
  [K in DripsContract]: {
    address: AddressLike;
    block: number;
  };
};

// ! DO NOT EXPORT THESE. It will fail in runtime. This is a hack to get the filter types.
const _dripsFilters = ({} as Drips).filters;
const _repoDriverFilters = ({} as RepoDriver).filters;
const _allFilters = { ..._dripsFilters, ..._repoDriverFilters };

export type DripsContractEvent = ValuesOf<typeof _dripsFilters>;
export type RepoDriverContractEvent = ValuesOf<typeof _repoDriverFilters>;

type EventSignaturePattern = `${string}(${string})`;

export type DripsContractEventSignature = {
  [T in KeysOf<typeof _dripsFilters>]: T extends string
    ? T extends EventSignaturePattern
      ? T
      : never
    : never;
}[KeysOf<typeof _dripsFilters>];

export type RepoDriverContractEventSignature = {
  [T in KeysOf<typeof _repoDriverFilters>]: T extends string
    ? T extends EventSignaturePattern
      ? T
      : never
    : never;
}[KeysOf<typeof _repoDriverFilters>];

export type DripsEventSignature =
  | DripsContractEventSignature
  | RepoDriverContractEventSignature;

export type EventSignatureToEventMap = {
  [K in DripsEventSignature]: (typeof _allFilters)[K];
};

export type DripsEvent = ValuesOf<EventSignatureToEventMap>;

export type TypedEventOutputObject<T> = T extends TypedContractEvent<
  any,
  any,
  infer OutputObject
>
  ? OutputObject
  : never;

export class HandleRequest<T extends DripsEventSignature> {
  public readonly id: UUID = randomUUID();
  public readonly eventLog: TypedEventLog<EventSignatureToEventMap[T]>;

  constructor(eventLog: TypedEventLog<EventSignatureToEventMap[T]>) {
    this.eventLog = eventLog;
  }
}

export type ModelCtor = {
  new (): Model;
  initialize(): void;
};

export type EventHandlerConstructor<T extends DripsEventSignature> = {
  new (): EventHandlerBase<T>;
};

export interface IEventModel {
  id: number;
  rawEvent: string;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
}
