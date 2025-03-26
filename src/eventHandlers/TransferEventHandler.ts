import { ZeroAddress } from 'ethers';
import type { TransferEvent } from '../../contracts/CURRENT_NETWORK/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import { calcAccountId, toNftDriverId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { DripListModel, TransferEventModel } from '../models';
import { dbConnection } from '../db/database';
import { isLatestEvent } from '../utils/eventUtils';
import appSettings from '../config/appSettings';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignatures = ['Transfer(address,address,uint256)' as const];

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
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
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

      const { visibilityThresholdBlockNumber } = appSettings;

      const dripList = await DripListModel.findOne({
        transaction,
        lock: true,
        where: {
          id,
        },
      });

      if (!dripList) {
        throw new Error(`Drip List with tokenId ${id} does not exist.`);
      }

      // Here, the Drip List already exists.
      // Only if the event is the latest (in the DB), we process its data.
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
      dripList.creator = to; // TODO: https://github.com/drips-network/events-processor/issues/14
      dripList.isVisible =
        blockNumber > visibilityThresholdBlockNumber
          ? from === ZeroAddress // If it's a mint, then the Drip List will be visible. If it's a real transfer, then it's not.
          : true; // If the block number is less than the visibility threshold, then the Drip List is visible by default.
      dripList.isValid = false; // The Drip List is not valid until the metadata is processed.

      logManager
        .appendIsLatestEventLog()
        .appendUpdateLog(dripList, DripListModel, dripList.id);

      await dripList.save({ transaction });

      logManager.logAllInfo();
    });
  }

  override async afterHandle(context: {
    args: [from: string, to: string, tokenId: bigint];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [from, to, tokenId] = args;

    await super.afterHandle({
      args: [tokenId, await calcAccountId(from), await calcAccountId(to)],
      blockTimestamp,
    });
  }
}
