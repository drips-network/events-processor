import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import sequelizeInstance from '../db/getSequelizeInstance';
import type { KnownAny, HandleContext } from '../common/types';
import { logRequestInfo } from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleContext<'OwnerUpdated(uint256,address)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { event, id: requestId } = request;
      const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
        event;
      const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

      logRequestInfo(
        `Event args: accountId ${accountId}, owner ${owner}.`,
        requestId,
      );

      await OwnerUpdatedEventModel.create(
        {
          owner,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: accountId.toString(),
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
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
