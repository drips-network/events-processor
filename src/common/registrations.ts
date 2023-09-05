import { OwnerUpdateRequestedEventHandler } from '../event-handlers';
import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedHandler';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  GitProjectModel,
  OwnerUpdateRequestedEventModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
} from '../models';
import {
  getEventHandler,
  getRegisteredEvents,
  registerEventHandler,
} from '../utils/registerEventHandler';
import { registerModel } from '../utils/registerModel';

// Register event handlers here.
function registerEventHandlers(): void {
  registerEventHandler(
    'OwnerUpdateRequested(uint256,uint8,bytes)',
    OwnerUpdateRequestedEventHandler,
  );
  registerEventHandler(
    'OwnerUpdated(uint256,address)',
    OwnerUpdatedEventHandler,
  );
  registerEventHandler(
    'AccountMetadataEmitted(uint256,bytes32,bytes)',
    AccountMetadataEmittedEventHandler,
  );
}

// Register models here.
function registerModels(): void {
  registerModel(GitProjectModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(RepoDriverSplitReceiverModel);
  registerModel(OwnerUpdateRequestedEventModel);
  registerModel(AddressDriverSplitReceiverModel);
  registerModel(AccountMetadataEmittedEventModel);
}

// Event listeners registration.
async function registerEventListeners(): Promise<void> {
  getRegisteredEvents().forEach(async (filterSignature) =>
    getEventHandler(filterSignature).registerEventListener(),
  );
}

export default function registerServices() {
  registerEventHandlers();
  registerModels();
  registerEventListeners();
}
