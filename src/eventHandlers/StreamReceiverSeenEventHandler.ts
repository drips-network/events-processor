import type { TypedListener, TypedContractEvent } from '../../contracts/common';
import type { StreamReceiverSeenEvent } from '../../contracts/Drips';
import LogManager from '../core/LogManager';
import type { KnownAny } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import StreamReceiverSeenEventModel from '../models/StreamReceiverSeenEventModel';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { toAccountId } from '../utils/accountIdUtils';
import { toBigIntString } from '../utils/bigintUtils';

export default class StreamReceiverSeenEventHandler extends EventHandlerBase<'StreamReceiverSeen(bytes32,uint256,uint256)'> {
  public eventSignature =
    'StreamReceiverSeen(bytes32,uint256,uint256)' as const;

  protected async _handle(
    request: EventHandlerRequest<'StreamReceiverSeen(bytes32,uint256,uint256)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawReceiversHash, rawAccountId, rawConfig] =
      args as StreamReceiverSeenEvent.OutputTuple;

    const accountId = toAccountId(rawAccountId);
    const config = toBigIntString(rawConfig.toString());

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - receiversHash: ${rawReceiversHash}
      \r\t - accountId:     ${accountId}
      \r\t - config:        ${config}
      \r\t - logIndex:      ${logIndex}
      \r\t - tx hash:       ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [streamReceiverSeenEvent, isEventCreated] =
        await StreamReceiverSeenEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            receiversHash: rawReceiversHash,
            accountId,
            config,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
          },
        });

      logManager.appendFindOrCreateLog(
        StreamReceiverSeenEventModel,
        isEventCreated,
        `${streamReceiverSeenEvent.transactionHash}-${streamReceiverSeenEvent.logIndex}`,
      );
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      StreamReceiverSeenEvent.InputTuple,
      StreamReceiverSeenEvent.OutputTuple,
      StreamReceiverSeenEvent.OutputObject
    >
  > = async (_receiversHash, _accountId, _config, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
