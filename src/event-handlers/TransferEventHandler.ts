import type { TransferEvent } from '../../contracts/NftDriver';
import EventHandlerBase from '../common/EventHandlerBase';
import sequelizeInstance from '../db/getSequelizeInstance';
import TransferEventModel from '../models/TransferEventModel';
import IsDripList from '../utils/dripListUtils';
import DripListModel from '../models/DripListModel';
import LogManager from '../common/LogManager';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import { saveEventProcessingJob } from '../queue';
import type { HandleRequest, KnownAny } from '../common/types';
import { toNftDriverId } from '../utils/accountIdUtils';
import { isLatestEvent } from '../utils/eventUtils';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignature = 'Transfer(address,address,uint256)' as const;

  protected async _handle(
    request: HandleRequest<'Transfer(address,address,uint256)'>,
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
      \r\t - tokenId:     ${tokenId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
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

      if (!(await IsDripList(id, transaction))) {
        return;
      }

      const [dripList, isDripListCreated] = await DripListModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id,
        },
        defaults: {
          id,
          isValid: false, // It will turn true after the metadata is updated.
          isPublic: false,
          ownerAddress: to,
          previousOwnerAddress: from,
        },
      });

      const isLatest = await isLatestEvent(
        transferEvent,
        TransferEventModel,
        {
          transactionHash,
          logIndex,
        },
        transaction,
      );

      if (isDripListCreated) {
        logManager
          .appendFindOrCreateLog(DripListModel, isDripListCreated, dripList.id)
          .logAllDebug();
      } else if (isLatest) {
        dripList.isValid = false; // It will turn true after the metadata is updated.
        dripList.ownerAddress = to;
        dripList.previousOwnerAddress = from;

        logManager
          .appendIsLatestEventLog()
          .appendUpdateLog(dripList, DripListModel, dripList.id);

        await dripList.save({ transaction });

        logManager.logAllDebug();
      }
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
