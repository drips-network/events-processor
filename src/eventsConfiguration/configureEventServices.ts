import {
  OwnerUpdateRequestedEventHandler,
  TransferEventHandler,
} from '../eventHandlers';
import AccountMetadataEmittedEventHandler from '../eventHandlers/AccountMetadataEmittedEvent/AccountMetadataEmittedEventHandler';
import OwnerUpdatedEventHandler from '../eventHandlers/OwnerUpdatedEventHandler';
import {
  AccountMetadataEmittedEventModel,
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  OwnerUpdateRequestedEventModel,
  OwnerUpdatedEventModel,
  RepoDriverSplitReceiverModel,
  TransferEventModel,
} from '../models';
import {
  getEventHandler,
  getRegisteredEvents,
  registerEventHandler,
} from './eventHandlerUtils';
import { registerModel } from '../db/registerModel';

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

async function registerEventListeners(): Promise<void> {
  const registeredEvents = getRegisteredEvents();

  registeredEvents.forEach(async (eventSignature) =>
    getEventHandler(eventSignature).registerEventListener(),
  );
}

export default function configureEventServices() {
  registerEventHandlers();
  registerModels();
  registerEventListeners();
}
