import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedHandler';
import OwnerUpdateRequestedEventHandler from '../event-handlers/OwnerUpdateRequestedEventHandler';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEvent/AccountMetadataEmittedEventModel';
import AddressDriverSplitReceiverModel from '../models/AddressDriverSplitReceiverModel';
import GitProjectModel from '../models/GitProjectModel';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import RepoDriverSplitReceiverModel from '../models/RepoDriverSplitReceiverModel';
import type {
  EventSignature,
  EventHandlerConstructor,
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
