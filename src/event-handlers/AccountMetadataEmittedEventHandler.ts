import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import type { KnownAny, HandleContext } from '../common/types';

import sequelizeInstance from '../db/getSequelizeInstance';
import { logRequestInfo } from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEvent/AccountMetadataEmittedEventModel';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleContext<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { event, id: requestId } = request;
      const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
        event;
      const [accountId, key, value] =
        args as AccountMetadataEmittedEvent.OutputTuple;

      logRequestInfo(
        `Event args: accountId ${accountId}, key ${key}, value ${value}}.`,
        requestId,
      );

      await AccountMetadataEmittedEventModel.create(
        {
          key,
          value,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: accountId.toString(),
        },
        { transaction, requestId },
      );
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
