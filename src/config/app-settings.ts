import type {
  IModelDefinitionConstructor,
  SupportedFilterSignature,
} from '../common/types';
import type { IEventHandlerConstructor } from '../common/EventHandlerBase';
import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmitted/AccountMetadataEmittedHandler';
import AccountMetadataEmittedEventModelDefinition from '../event-handlers/AccountMetadataEmitted/AccountMetadataEmittedEventModel';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler/OwnerUpdatedEventHandler';
import OwnerUpdateRequestedEventHandler from '../event-handlers/OwnerUpdateRequestedEventHandler/OwnerUpdateRequestedEventHandler';
import { OwnerUpdatedEventModelDefinition } from '../event-handlers/OwnerUpdatedEventHandler/OwnerUpdatedEventModel';
import { OwnerUpdateRequestedEventModelDefinition } from '../event-handlers/OwnerUpdateRequestedEventHandler/OwnerUpdateRequestedEventModel';
import { GitProjectModelDefinition } from '../models/GitProjectModel';
import { ProcessHistoryModelDefinition } from '../models/ProcessHistoryModel';

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
export const MODEL_DEFINITIONS: IModelDefinitionConstructor<any, any>[] = [
  GitProjectModelDefinition,
  ProcessHistoryModelDefinition,
  OwnerUpdatedEventModelDefinition,
  AccountMetadataEmittedEventModelDefinition,
  OwnerUpdateRequestedEventModelDefinition,
];
