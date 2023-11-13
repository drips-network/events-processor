import {
  OwnerUpdateRequestedEventHandler,
  TransferEventHandler,
} from '../eventHandlers';
import AccountMetadataEmittedEventHandler from '../eventHandlers/AccountMetadataEmittedEvent/AccountMetadataEmittedEventHandler';
import GivenEventHandler from '../eventHandlers/GivenEventHandler';
import OwnerUpdatedEventHandler from '../eventHandlers/OwnerUpdatedEventHandler';
import {
  getEventHandler,
  getRegisteredEvents,
  registerEventHandler,
} from './eventHandlerUtils';

export function registerEventHandlers(): void {
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
  registerEventHandler<'Given(uint256,uint256,address,uint128)'>(
    'Given(uint256,uint256,address,uint128)',
    GivenEventHandler,
  );
}

export async function registerEventListeners(): Promise<void> {
  const registeredEvents = getRegisteredEvents();

  registeredEvents.forEach(async (eventSignature) =>
    getEventHandler(eventSignature).registerEventListener(),
  );
}
