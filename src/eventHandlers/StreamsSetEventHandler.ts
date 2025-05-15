import type { StreamsSetEvent } from '../../contracts/CURRENT_NETWORK/Drips';
import ScopedLogger from '../core/ScopedLogger';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import StreamsSetEventModel from '../models/StreamsSetEventModel';
import { convertToAccountId } from '../utils/accountIdUtils';
import { toBigIntString } from '../utils/bigintUtils';

export default class StreamsSetEventHandler extends EventHandlerBase<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'> {
  public eventSignatures = [
    'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)' as const,
  ];

  protected async _handle(
    request: EventHandlerRequest<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [
      rawAccountId,
      rawErc20,
      rawReceiversHash,
      rawStreamsHistoryHash,
      rawBalance,
      rawMaxEnd,
    ] = args as StreamsSetEvent.OutputTuple;

    const accountId = convertToAccountId(rawAccountId);
    const balance = toBigIntString(rawBalance.toString());
    const maxEnd = toBigIntString(rawMaxEnd.toString());

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - accountId:          ${accountId}
      \r\t - erc20:              ${rawErc20}
      \r\t - receiversHash:      ${rawReceiversHash}
      \r\t - streamsHistoryHash: ${rawStreamsHistoryHash}
      \r\t - balance:            ${balance}
      \r\t - maxEnd:             ${maxEnd}
      \r\t - logIndex:           ${logIndex}
      \r\t - tx hash:            ${transactionHash}`,
    );

    await dbConnection.transaction(async (transaction) => {
      const streamsSetEvent = await StreamsSetEventModel.create(
        {
          accountId,
          erc20: rawErc20,
          receiversHash: rawReceiversHash,
          streamsHistoryHash: rawStreamsHistoryHash,
          balance,
          maxEnd,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction,
        },
      );

      scopedLogger.bufferCreation({
        type: StreamsSetEventModel,
        input: streamsSetEvent,
        id: `${streamsSetEvent.transactionHash}-${streamsSetEvent.logIndex}`,
      });

      scopedLogger.flush();
    });
  }
}
