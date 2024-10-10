import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import { toAccountId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { dbConnection } from '../db/database';
import type { SqueezedStreamsEvent } from '../../contracts/CURRENT_NETWORK/Drips';
import { toAddress } from '../utils/ethereumAddressUtils';
import { toBigIntString } from '../utils/bigintUtils';
import SqueezedStreamsEventModel from '../models/SqueezedStreamsEventModel';

export default class SqueezedStreamsEventHandler extends EventHandlerBase<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'> {
  public eventSignatures = [
    'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])' as const,
  ];

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
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
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
}
