import EventHandlerBase from '../events/EventHandlerBase';
import ScopedLogger from '../core/ScopedLogger';
import { convertToAccountId } from '../utils/accountIdUtils';
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

    const accountId = convertToAccountId(rawAccountId);
    const erc20 = toAddress(rawErc20);
    const senderId = convertToAccountId(rawSenderId);
    const amt = toBigIntString(rawAmt.toString());
    const streamsHistoryHashes =
      SqueezedStreamsEventModel.toStreamHistoryHashes(rawStreamsHistoryHashes);

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - accountId:            ${accountId}
      \r\t - erc20:                ${erc20}
      \r\t - senderId:             ${senderId}
      \r\t - amt:                  ${amt}
      \r\t - streamsHistoryHashes: ${streamsHistoryHashes}
      \r\t - logIndex:             ${logIndex}
      \r\t - tx hash:              ${transactionHash}`,
    );

    await dbConnection.transaction(async (transaction) => {
      const transferEvent = await SqueezedStreamsEventModel.create(
        {
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
        { transaction },
      );

      scopedLogger.bufferCreation({
        input: transferEvent,
        type: SqueezedStreamsEventModel,
        id: `${transferEvent.transactionHash}-${transferEvent.logIndex}`,
      });

      scopedLogger.flush();
    });
  }
}
