import type { StreamReceiverSeenEvent } from '../../contracts/CURRENT_NETWORK/Drips';
import ScopedLogger from '../core/ScopedLogger';
import type { AccountId } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import StreamReceiverSeenEventModel from '../models/StreamReceiverSeenEventModel';
import { convertToAccountId } from '../utils/accountIdUtils';
import { toBigIntString } from '../utils/bigintUtils';
import { getCurrentSplitReceiversByReceiversHash } from './AccountMetadataEmittedEvent/receiversRepository';

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

    const accountId = convertToAccountId(rawAccountId);
    const config = toBigIntString(rawConfig.toString());

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - receiversHash: ${rawReceiversHash}
      \r\t - accountId:     ${accountId}
      \r\t - config:        ${config}
      \r\t - logIndex:      ${logIndex}
      \r\t - tx hash:       ${transactionHash}`,
    );

    await dbConnection.transaction(async (transaction) => {
      const streamReceiverSeenEvent = await StreamReceiverSeenEventModel.create(
        {
          receiversHash: rawReceiversHash,
          accountId,
          config,
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
        type: StreamReceiverSeenEventModel,
        input: streamReceiverSeenEvent,
        id: `${streamReceiverSeenEvent.transactionHash}-${streamReceiverSeenEvent.logIndex}`,
      });
    });
  }

  public override async beforeHandle({
    event: { args },
    id: requestId,
  }: EventHandlerRequest<'StreamReceiverSeen(bytes32,uint256,uint256)'>): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(`${this.name} is gathering accountIds to invalidate...`);

    const [rawReceiversHash] = args as StreamReceiverSeenEvent.OutputTuple;

    const accountIdsToInvalidate =
      await getCurrentSplitReceiversByReceiversHash(rawReceiversHash);

    scopedLogger.log(
      `${this.name} account IDs to invalidate: ${accountIdsToInvalidate.join(
        ', ',
      )}`,
    );

    return {
      accountIdsToInvalidate,
    };
  }
}
