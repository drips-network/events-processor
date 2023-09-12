import {
  OwnerUpdateRequestedEventHandler,
  TransferEventHandler,
} from '../event-handlers';
import AccountMetadataEmittedEventHandler from '../event-handlers/AccountMetadataEmittedEventHandler';
import OwnerUpdatedEventHandler from '../event-handlers/OwnerUpdatedEventHandler';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  GitProjectModel,
  OwnerUpdateRequestedEventModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
} from '../models';
import DripListModel from '../models/DripListModel';
import DripListSplitReceiverModel from '../models/DripListSplitReceiverModel';
import TransferEventModel from '../models/TransferEvent/TransferEventModel';
import {
  getEventHandler,
  getRegisteredEvents,
  registerEventHandler,
} from '../utils/registerEventHandler';
import { registerModel } from '../utils/registerModel';

// Register event handlers here.
function registerEventHandlers(): void {
  registerEventHandler<'OwnerUpdateRequested(uint256,uint8,bytes)'>(
    'OwnerUpdateRequested(uint256,uint8,bytes)',
    OwnerUpdateRequestedEventHandler,
  );
  registerEventHandler<'OwnerUpdated(uint256,address)'>(
    'OwnerUpdated(uint256,address)',
    OwnerUpdatedEventHandler,
  );
  registerEventHandler<'AccountMetadataEmitted(uint256,bytes32,bytes)'>(
    'AccountMetadataEmitted(uint256,bytes32,bytes)',
    AccountMetadataEmittedEventHandler,
  );
  registerEventHandler<'Transfer(address,address,uint256)'>(
    'Transfer(address,address,uint256)',
    TransferEventHandler,
  );
}

// Register models here.
function registerModels(): void {
  registerModel(DripListModel);
  registerModel(GitProjectModel);
  registerModel(TransferEventModel);
  registerModel(OwnerUpdatedEventModel);
  registerModel(DripListSplitReceiverModel);
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
