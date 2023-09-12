import type { TypedListener, TypedContractEvent } from '../../contracts/common';
import type { TransferEvent } from '../../contracts/NftDriver';
import EventHandlerBase from '../common/EventHandlerBase';
import type { HandleContext, KnownAny } from '../common/types';
import sequelizeInstance from '../db/getSequelizeInstance';
import TransferEventModel from '../models/TransferEvent/TransferEventModel';
import { saveEventProcessingJob } from '../queue';
import { assertNftDriverAccountId } from '../utils/assert';
import { logRequestInfo } from '../utils/logRequest';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignature = 'Transfer(address,address,uint256)' as const;

  protected async _handle(
    request: HandleContext<'Transfer(address,address,uint256)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { event, id: requestId } = request;
      const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
        event;
      const [from, to, tokenId] = args as TransferEvent.OutputTuple;

      logRequestInfo(
        `Event args: from ${from}, to ${to}, tokenId ${tokenId}.`,
        requestId,
      );

      const id = tokenId.toString();
      assertNftDriverAccountId(id);

      await TransferEventModel.create(
        {
          tokenId: id,
          to,
          from,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction,
          requestId,
        },
      );
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      TransferEvent.InputTuple,
      TransferEvent.OutputTuple,
      TransferEvent.OutputObject
    >
  > = async (_from, _to, _tokenId, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
