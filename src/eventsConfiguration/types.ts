import type { Drips, NftDriver, RepoDriver } from '../../contracts';
import type {
  TypedContractEvent,
  TypedLogDescription,
} from '../../contracts/common';
import type EventHandlerBase from './EventHandlerBase';
import type { ValuesOf } from '../common/types';

// -------------------------- Filter types inference -----------------------------------------
// ! DO NOT EXPORT THESE. It will fail in runtime.
// This is a utility code snippet used for inferring filter types from different contracts.

const _dripsFilters = ({} as Drips).filters;
const _nftDriverFilters = ({} as NftDriver).filters;
const _repoDriverFilters = ({} as RepoDriver).filters;

// Drips event names across different drivers are unique.
// If the events were not unique, spreading filters like this could cause some filters to be overwritten!
const _allFilters = {
  ..._dripsFilters,
  ..._nftDriverFilters,
  ..._repoDriverFilters,
};
// -------------------------------------------------------------------------------------------

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

export type SupportedEvent = ValuesOf<EventSignatureToEventMap>;

export type ExtractOutputObject<T> = T extends TypedContractEvent<
  any,
  infer TOutputTuple,
  any
>
  ? TOutputTuple
  : never;

type EventArgs<T extends SupportedEvent> = TypedLogDescription<T>['args'];

export type EventData<T extends EventSignature> = {
  logIndex: number;
  eventSignature: T;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
  args: EventArgs<EventSignatureToEventMap[T]>;
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
