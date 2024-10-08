import type { StreamReceiverSeenEvent } from '../../contracts/CURRENT_NETWORK/Drips';
import LogManager from '../core/LogManager';
import type { AccountId } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import StreamReceiverSeenEventModel from '../models/StreamReceiverSeenEventModel';
import { toAccountId } from '../utils/accountIdUtils';
import { toBigIntString } from '../utils/bigintUtils';
import { getCurrentSplitsByReceiversHash } from '../utils/getCurrentSplits';

export default class StreamReceiverSeenEventHandler extends EventHandlerBase<'StreamReceiverSeen(bytes32,uint256,uint256)'> {
  public eventSignatures = [
    'StreamReceiverSeen(bytes32,uint256,uint256)' as const,
  ];

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
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
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

  public override async beforeHandle(
    request: EventHandlerRequest<'StreamReceiverSeen(bytes32,uint256,uint256)'>,
  ): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    const {
      event: { args },
    } = request;

    const [rawReceiversHash] = args as StreamReceiverSeenEvent.OutputTuple;

    return {
      accountIdsToInvalidate:
        await getCurrentSplitsByReceiversHash(rawReceiversHash),
    };
  }
}
