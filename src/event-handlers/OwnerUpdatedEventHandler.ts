import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEvent/OwnerUpdatedEventModel';
import sequelizeInstance from '../utils/getSequelizeInstance';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import { HandleRequest } from '../common/types';
import { logRequestInfo } from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  protected eventSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdated(uint256,address)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;
      const { accountId, owner } = eventLog.args;

      logRequestInfo(
        `Event data was accountId: ${accountId}, owner: ${owner}.`,
        requestId,
      );

      await OwnerUpdatedEventModel.create(
        {
          owner,
          logIndex: eventLog.index,
          accountId: accountId.toString(),
          rawEvent: JSON.stringify(eventLog),
          blockNumber: eventLog.blockNumber,
          blockTimestamp:
            (await eventLog.getBlock()).date ?? shouldNeverHappen(),
          transactionHash: eventLog.transactionHash,
        },
        {
          transaction,
          requestId,
        },
      );
    });
  }

  protected readonly onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdatedEvent.InputTuple,
      OwnerUpdatedEvent.OutputTuple,
      OwnerUpdatedEvent.OutputObject
    >
  > = async (_accountId, _owner, eventLog) => {
    await this.executeHandle(new HandleRequest((eventLog as any).log));
  };
}
