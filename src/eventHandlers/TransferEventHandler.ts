import { ZeroAddress } from 'ethers';
import type { TransferEvent } from '../../contracts/CURRENT_NETWORK/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import { calcAccountId, toNftDriverId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { DripListModel, EcosystemModel, TransferEventModel } from '../models';
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
          where: { logIndex, transactionHash },
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

      const isLatest = await isLatestEvent(
        transferEvent,
        TransferEventModel,
        { transactionHash, logIndex, tokenId },
        transaction,
      );

      if (!isLatest) {
        logManager.logAllInfo();

        return;
      }

      const [dripList, ecosystem] = await Promise.all([
        DripListModel.findOne({ transaction, lock: true, where: { id } }),
        EcosystemModel.findOne({ transaction, lock: true, where: { id } }),
      ]);

      if (!dripList && !ecosystem) {
        throw new Error(
          `Drip List or Ecosystem not found for tokenId '${tokenId}'. Maybe the 'AccountMetadataEmitted' event that should have created the entity was not processed yet?`,
        );
      }

      const entity = (dripList ?? ecosystem)!;
      const entityModel = dripList ? DripListModel : EcosystemModel;

      entity.ownerAddress = to;
      entity.previousOwnerAddress = from;
      entity.ownerAccountId = await calcAccountId(to);
      entity.creator = to; // TODO: https://github.com/drips-network/events-processor/issues/14
      entity.isVisible =
        blockNumber > appSettings.visibilityThresholdBlockNumber
          ? from === ZeroAddress
          : true;
      entity.isValid = true;

      logManager
        .appendIsLatestEventLog()
        .appendUpdateLog(entity, entityModel, entity.id);

      await entity.save({ transaction });

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
