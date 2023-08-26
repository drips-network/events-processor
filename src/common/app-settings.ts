import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedHandler';
import AccountMetadataEmittedEvent from '../models/AccountMetadataEmittedEventModel';
import OwnerUpdatedEvent from '../models/OwnerUpdatedEventModel';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler';
import OwnerUpdateRequestedEventHandler from '../event-handlers/OwnerUpdateRequestedEventHandler';
import OwnerUpdateRequestedEvent from '../models/OwnerUpdateRequestedEventModel';
import type {
  DripsEventSignature,
  EventHandlerConstructor,
  ModelCtor,
} from './types';
import GitProjectModel from '../models/GitProjectModel';

// Register event handlers here.
export const EVENT_HANDLERS: Partial<{
  [T in DripsEventSignature]: EventHandlerConstructor<T>;
}> = {
  'OwnerUpdated(uint256,address)': OwnerUpdatedEventHandler,
  'OwnerUpdateRequested(uint256,uint8,bytes)': OwnerUpdateRequestedEventHandler,
  'AccountMetadataEmitted(uint256,bytes32,bytes)':
    AccountMetadataEmittedEventHandler,
} as const;

// Register models here.
export const MODELS: ModelCtor[] = [
  GitProjectModel,
  AccountMetadataEmittedEvent,
  OwnerUpdatedEvent,
  OwnerUpdateRequestedEvent,
];
