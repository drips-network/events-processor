import type { TransferEvent } from '../../contracts/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { KnownAny } from '../core/types';
import { calcAccountId, toNftDriverId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { DripListModel, TransferEventModel } from '../models';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { dbConnection } from '../db/database';
import { isLatestEvent } from '../utils/eventUtils';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignature = 'Transfer(address,address,uint256)' as const;

  protected async _handle(
    request: EventHandlerRequest<'Transfer(address,address,uint256)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [from, to, tokenId] = args as TransferEvent.OutputTuple;

    const id = toNftDriverId(tokenId);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - from:        ${from}
      \r\t - to:          ${to}
      \r\t - tokenId:     ${tokenId}
      \r\t - logIndex:    ${logIndex}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [transferEvent, isEventCreated] =
        await TransferEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            tokenId: id,
            to,
            from,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
          },
        });

      logManager.appendFindOrCreateLog(
        TransferEventModel,
        isEventCreated,
        `${transferEvent.transactionHash}-${transferEvent.logIndex}`,
      );

      // This must be the only place a Drip List is created.
      const [dripList, isDripListCreated] = await DripListModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id,
        },
        defaults: {
          id,
          creator: to, // TODO: https://github.com/drips-network/events-processor/issues/14
          isValid: true, // There are no receivers yet, so the drip list is valid.
          ownerAddress: to,
          ownerAccountId: await calcAccountId(to),
          previousOwnerAddress: from,
        },
      });

      if (isDripListCreated) {
        logManager
          .appendFindOrCreateLog(DripListModel, isDripListCreated, dripList.id)
          .logAllInfo();

        return;
      }

      // Here, the Drip List already exists.
      // Only if the event is the latest (in the DB), we process the metadata.
      // After all events are processed, the Drip List will be updated with the latest values.
      if (
        !(await isLatestEvent(
          transferEvent,
          TransferEventModel,
          {
            transactionHash,
            logIndex,
            tokenId,
          },
          transaction,
        ))
      ) {
        logManager.logAllInfo();

        return;
      }

      dripList.ownerAddress = to;
      dripList.previousOwnerAddress = from;
      dripList.ownerAccountId = await calcAccountId(to);

      logManager
        .appendIsLatestEventLog()
        .appendUpdateLog(dripList, DripListModel, dripList.id);

      await dripList.save({ transaction });

      logManager.logAllInfo();
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

  override async afterHandle(
    from: string,
    to: string,
    tokenId: bigint,
  ): Promise<void> {
    super.afterHandle(...[tokenId, calcAccountId(from), calcAccountId(to)]);
  }
}
