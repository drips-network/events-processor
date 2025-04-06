import EventHandlerBase from '../../events/EventHandlerBase';
import LogManager from '../../core/LogManager';
import { convertToAccountId } from '../../utils/accountIdUtils';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { SplitsSetEventModel } from '../../models';
import { dbConnection } from '../../db/database';
import type { SplitsSetEvent } from '../../../contracts/CURRENT_NETWORK/Drips';
import setIsValidFlag from './setIsValidFlag';

export default class SplitsSetEventHandler extends EventHandlerBase<'SplitsSet(uint256,bytes32)'> {
  public eventSignatures = ['SplitsSet(uint256,bytes32)' as const];

  protected async _handle(
    request: EventHandlerRequest<'SplitsSet(uint256,bytes32)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawAccountId, rawReceiversHash] = args as SplitsSetEvent.OutputTuple;
    const accountId = convertToAccountId(rawAccountId);

    LogManager.logRequestInfo(
      [
        `📥 ${this.name} is processing the following ${request.event.eventSignature}:`,
        `  - accountId:     ${accountId}`,
        `  - receiversHash: ${rawReceiversHash}`,
        `  - logIndex:      ${logIndex}`,
        `  - txHash:        ${transactionHash}`,
      ].join('\n'),
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const splitsSetEvent = await SplitsSetEventModel.create(
        {
          accountId,
          receiversHash: rawReceiversHash,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction,
        },
      );

      logManager.appendFindOrCreateLog(
        SplitsSetEventModel,
        true,
        `${splitsSetEvent.transactionHash}-${splitsSetEvent.logIndex}`,
      );

      // Account's splits are set from `AccountMetadataEmitted` events.
      // `SplitsSet` event only validates the splits receivers.

      try {
        await setIsValidFlag(splitsSetEvent, logManager, transaction);
      } catch (error: any) {
        logManager.logAllInfo(this.name);

        throw error;
      }
    });
  }
}
