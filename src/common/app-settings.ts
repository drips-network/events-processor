import {
  OwnerUpdateRequestedEventHandler,
  OwnerUpdatedEventHandler,
} from '../event-handlers';
import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedHandler';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  GitProjectModel,
  OwnerUpdateRequestedEventModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
} from '../models';
import type {
  EventHandlerConstructor,
  EventSignature,
  ModelStaticMembers,
} from './types';

// Register event handlers here.
export const EVENT_HANDLERS: Partial<{
  [T in EventSignature]: EventHandlerConstructor<T>;
}> = {
  'AccountMetadataEmitted(uint256,bytes32,bytes)':
    AccountMetadataEmittedEventHandler,
  'OwnerUpdated(uint256,address)': OwnerUpdatedEventHandler,
  'OwnerUpdateRequested(uint256,uint8,bytes)': OwnerUpdateRequestedEventHandler,
} as const;

// Register models here.
export const MODELS: ModelStaticMembers[] = [
  GitProjectModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
  OwnerUpdateRequestedEventModel,
  AddressDriverSplitReceiverModel,
  AccountMetadataEmittedEventModel,
];
