import EventHandlerBase from '../../events/EventHandlerBase';
import LogManager from '../../core/LogManager';
import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import type { KnownAny } from '../../core/types';
import { toAccountId } from '../../utils/accountIdUtils';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { SplitsSetEventModel } from '../../models';
import saveEventProcessingJob from '../../queue/saveEventProcessingJob';
import { dbConnection } from '../../db/database';
import type { SplitsSetEvent } from '../../../contracts/Drips';
import setIsValidFlag from './setIsValidFlag';

export default class SplitsSetEventHandler extends EventHandlerBase<'SplitsSet(uint256,bytes32)'> {
  public eventSignature = 'SplitsSet(uint256,bytes32)' as const;

  protected async _handle(
    request: EventHandlerRequest<typeof this.eventSignature>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawAccountId, rawReceiversHash] = args as SplitsSetEvent.OutputTuple;
    const accountId = toAccountId(rawAccountId);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - accountId:     ${accountId}
      \r\t - receiversHash: ${rawReceiversHash}
      \r\t - logIndex:      ${logIndex}
      \r\t - tx hash:       ${transactionHash}`,
      requestId,
    );

    const logManager = new LogManager(requestId);

    const splitsSetEvent = await dbConnection.transaction(
      async (transaction) => {
        const [splitsSetEventModel, isEventCreated] =
          await SplitsSetEventModel.findOrCreate({
            lock: true,
            transaction,
            where: {
              logIndex,
              transactionHash,
            },
            defaults: {
              accountId,
              receiversHash: rawReceiversHash,
              logIndex,
              blockNumber,
              blockTimestamp,
              transactionHash,
            },
          });

        logManager.appendFindOrCreateLog(
          SplitsSetEventModel,
          isEventCreated,
          `${splitsSetEventModel.transactionHash}-${splitsSetEventModel.logIndex}`,
        );

        return splitsSetEventModel;
      },
    );

    // Account's splits are set from `AccountMetadataEmitted` events.
    // `SplitsSet` event only validates the splits receivers.

    try {
      await setIsValidFlag(splitsSetEvent, logManager);
    } catch (error: any) {
      logManager.logAllInfo();

      throw error;
    }
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      SplitsSetEvent.InputTuple,
      SplitsSetEvent.OutputTuple,
      SplitsSetEvent.OutputObject
    >
  > = async (_accId, _receiversHash, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
