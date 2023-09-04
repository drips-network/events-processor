import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import { HandleRequest } from '../common/types';

import sequelizeInstance from '../db/getSequelizeInstance';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import { logRequestInfo } from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEvent/AccountMetadataEmittedEventModel';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;
      const { accountId, key, value } =
        eventLog.args as AccountMetadataEmittedEvent.OutputObject;

      logRequestInfo(
        `Event args: accountId ${accountId}, key ${key}, value ${value}}.`,
        requestId,
      );

      await AccountMetadataEmittedEventModel.create(
        {
          key,
          value,
          logIndex: eventLog.index,
          accountId: accountId.toString(),
          blockNumber: eventLog.blockNumber,
          blockTimestamp:
            (await eventLog.getBlock()).date ?? shouldNeverHappen(),
          transactionHash: eventLog.transactionHash,
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
    await super.executeHandle(new HandleRequest((eventLog as any).log));
  };
}
