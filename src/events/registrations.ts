import {
  AccountMetadataEmittedEventHandler,
  GivenEventHandler,
  OwnerUpdateRequestedEventHandler,
  OwnerUpdatedEventHandler,
  SplitEventHandler,
  SplitsSetEventHandler,
  TransferEventHandler,
  StreamReceiverSeenEventHandler,
  StreamsSetEventHandler,
  SqueezedStreamsEventHandler,
  CreatedSplitsEventHandler,
} from '../eventHandlers';
import { registerEventHandler } from './eventHandlerUtils';

export function registerEventHandlers(): void {
  registerEventHandler<
    | 'OwnerUpdateRequested(uint256,uint8,bytes,address)'
    | 'OwnerUpdateRequested(uint256,uint8,bytes)'
  >(
    [
      'OwnerUpdateRequested(uint256,uint8,bytes,address)',
      'OwnerUpdateRequested(uint256,uint8,bytes)',
    ],
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
  registerEventHandler<'Split(uint256,uint256,address,uint128)'>(
    'Split(uint256,uint256,address,uint128)',
    SplitEventHandler,
  );
  registerEventHandler<'SplitsSet(uint256,bytes32)'>(
    'SplitsSet(uint256,bytes32)',
    SplitsSetEventHandler,
  );
  registerEventHandler<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'>(
    'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)',
    StreamsSetEventHandler,
  );
  registerEventHandler<'StreamReceiverSeen(bytes32,uint256,uint256)'>(
    'StreamReceiverSeen(bytes32,uint256,uint256)',
    StreamReceiverSeenEventHandler,
  );
  registerEventHandler<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'>(
    'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])',
    SqueezedStreamsEventHandler,
  );
  registerEventHandler<'CreatedSplits(uint256,bytes32)'>(
    'CreatedSplits(uint256,bytes32)',
    CreatedSplitsEventHandler,
  );
}
