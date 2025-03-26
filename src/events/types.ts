import type EventHandlerBase from './EventHandlerBase';
import type { ValuesOf } from '../core/types';
import type {
  AnyChainDripsFilters,
  AnyChainImmutableSplitsDriverFilters,
  AnyChainNftDriverFilters,
  AnyChainRepoDriverFilters,
  AnyChainTypedLogDescription,
} from '../../contracts/contract-types';

// flat object type with all keys and values from the above
type AllFilters = AnyChainDripsFilters &
  AnyChainNftDriverFilters &
  AnyChainRepoDriverFilters &
  AnyChainImmutableSplitsDriverFilters;

export type DripsContractEvent = ValuesOf<AnyChainDripsFilters>;
export type NftDriverContractEvent = ValuesOf<AnyChainNftDriverFilters>;
export type RepoDriverContractEvent = ValuesOf<AnyChainRepoDriverFilters>;
export type ImmutableSplitsDriverContractEvent =
  ValuesOf<AnyChainImmutableSplitsDriverFilters>;

type OnlySignatures<T> = T extends `${infer Prefix}(${infer Suffix})`
  ? `${Prefix}(${Suffix})`
  : never;

export type EventSignature = OnlySignatures<keyof AllFilters>;

export type EventSignatureToEventMap = {
  [K in EventSignature]: AllFilters[K];
};

export type SupportedEvent = ValuesOf<EventSignatureToEventMap>;

type EventArgs<T extends SupportedEvent> =
  AnyChainTypedLogDescription<T>['args'];

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
