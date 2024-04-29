import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { KnownAny } from '../core/types';
import { toAccountId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { dbConnection } from '../db/database';
import type { SqueezedStreamsEvent } from '../../contracts/Drips';
import { toAddress } from '../utils/ethereumAddressUtils';
import { toBigIntString } from '../utils/bigintUtils';
import SqueezedStreamsEventModel from '../models/SqueezedStreamsEventModel';

export default class SqueezedStreamsEventHandler extends EventHandlerBase<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'> {
  public eventSignature =
    'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])' as const;

  protected async _handle(
    request: EventHandlerRequest<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [
      rawAccountId,
      rawErc20,
      rawSenderId,
      rawAmt,
      rawStreamsHistoryHashes,
    ] = args as SqueezedStreamsEvent.OutputTuple;

    const accountId = toAccountId(rawAccountId);
    const erc20 = toAddress(rawErc20);
    const senderId = toAccountId(rawSenderId);
    const amt = toBigIntString(rawAmt.toString());
    const streamsHistoryHashes =
      SqueezedStreamsEventModel.toStreamHistoryHashes(rawStreamsHistoryHashes);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - accountId:            ${accountId}
      \r\t - erc20:                ${erc20}
      \r\t - senderId:             ${senderId}
      \r\t - amt:                  ${amt}
      \r\t - streamsHistoryHashes: ${streamsHistoryHashes}
      \r\t - logIndex:             ${logIndex}
      \r\t - tx hash:              ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [transferEvent, isEventCreated] =
        await SqueezedStreamsEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            accountId,
            erc20,
            senderId,
            amount: amt,
            streamsHistoryHashes,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
          },
        });

      logManager.appendFindOrCreateLog(
        SqueezedStreamsEventModel,
        isEventCreated,
        `${transferEvent.transactionHash}-${transferEvent.logIndex}`,
      );

      logManager.logAllInfo();
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      SqueezedStreamsEvent.InputTuple,
      SqueezedStreamsEvent.OutputTuple,
      SqueezedStreamsEvent.OutputObject
    >
  > = async (_from, _to, _tokenId, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
