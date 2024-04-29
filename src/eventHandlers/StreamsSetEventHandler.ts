import type { TypedListener, TypedContractEvent } from '../../contracts/common';
import type { StreamsSetEvent } from '../../contracts/Drips';
import LogManager from '../core/LogManager';
import type { KnownAny } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import StreamsSetEventModel from '../models/StreamsSetEventModel';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { toAccountId } from '../utils/accountIdUtils';
import { toBigIntString } from '../utils/bigintUtils';

export default class StreamsSetEventHandler extends EventHandlerBase<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'> {
  public eventSignature =
    'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)' as const;

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

    const accountId = toAccountId(rawAccountId);
    const balance = toBigIntString(rawBalance.toString());
    const maxEnd = toBigIntString(rawMaxEnd.toString());

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - accountId:          ${accountId}
      \r\t - erc20:              ${rawErc20}
      \r\t - receiversHash:      ${rawReceiversHash}
      \r\t - streamsHistoryHash: ${rawStreamsHistoryHash}
      \r\t - balance:            ${balance}
      \r\t - maxEnd:             ${maxEnd}
      \r\t - logIndex:           ${logIndex}
      \r\t - tx hash:            ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [streamsSetEvent, isEventCreated] =
        await StreamsSetEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
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
        });

      logManager.appendFindOrCreateLog(
        StreamsSetEventModel,
        isEventCreated,
        `${streamsSetEvent.transactionHash}-${streamsSetEvent.logIndex}`,
      );
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      StreamsSetEvent.InputTuple,
      StreamsSetEvent.OutputTuple,
      StreamsSetEvent.OutputObject
    >
  > = async (
    _accountId,
    _erc20,
    _receiversHash,
    _streamsHistoryHash,
    _balance,
    _maxEnd,
    eventLog,
  ) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
