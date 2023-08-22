import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import { EventHandlerBase } from '../common/EventHandlerBase';
import executeDbTransaction from '../utils/execute-db-transaction';
import getEventOutput from '../utils/get-event-output';
import { HandleRequest } from '../common/types';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEventModel';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public filterSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;

    const [accountId, key, value] =
      await getEventOutput<AccountMetadataEmittedEvent.OutputTuple>(eventLog);

    await executeDbTransaction(
      async (transaction) =>
        AccountMetadataEmittedEventModel.create(
          {
            accountId: accountId.toString(),
            key,
            value,
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            rawEvent: JSON.stringify(eventLog),
            transactionHash: eventLog.transactionHash,
            blockTimestamp: (await eventLog.getBlock()).date,
          },
          { transaction },
        ),
      requestId,
    );
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) =>
    this.executeHandle(new HandleRequest((eventLog as any).log));
}
