import type { ModelCtor, SupportedFilterSignature } from '../common/types';
import type { IEventHandlerConstructor } from '../common/EventHandlerBase';
import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedHandler';
import { GitProjectModel } from '../models/GitProjectModel';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEventModel';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler';
import OwnerUpdateRequestedEventHandler from '../event-handlers/OwnerUpdateRequestedEventHandler';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';

// Register event handlers here.
export const EVENT_HANDLERS: Partial<{
  [T in SupportedFilterSignature]: IEventHandlerConstructor<T>;
}> = {
  'OwnerUpdated(uint256,address)': OwnerUpdatedEventHandler,
  'OwnerUpdateRequested(uint256,uint8,bytes)': OwnerUpdateRequestedEventHandler,
  'AccountMetadataEmitted(uint256,bytes32,bytes)':
    AccountMetadataEmittedEventHandler,
} as const;

// Register models here.
export const MODELS: ModelCtor[] = [
  GitProjectModel,
  AccountMetadataEmittedEventModel,
  OwnerUpdatedEventModel,
  OwnerUpdateRequestedEventModel,
];
