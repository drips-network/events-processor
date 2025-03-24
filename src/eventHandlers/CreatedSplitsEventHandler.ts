import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import {
  toAccountId,
  toImmutableSplitsDriverId,
} from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { dbConnection } from '../db/database';
import type { CreatedSplitsEvent } from '../../contracts/CURRENT_NETWORK/ImmutableSplitsDriver';
import CreatedSplitsEventModel from '../models/CreatedSplitsEventModel';
import SubListModel from '../models/SubListModel';
import unreachableError from '../utils/unreachableError';

export default class SplitEventHandler extends EventHandlerBase<'CreatedSplits(uint256,bytes32)'> {
  public eventSignatures = ['CreatedSplits(uint256,bytes32)' as const];

  protected async _handle(
    request: EventHandlerRequest<'CreatedSplits(uint256,bytes32)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawAccountId, rawReceiversHash] =
      args as CreatedSplitsEvent.OutputTuple;

    const accountId = toAccountId(rawAccountId);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - accountId:     ${rawAccountId}
      \r\t - receiversHash: ${rawReceiversHash}
      \r\t - logIndex:      ${logIndex}
      \r\t - tx hash:       ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [createdSplitsEvent, isEventCreated] =
        await CreatedSplitsEventModel.findOrCreate({
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
        CreatedSplitsEventModel,
        isEventCreated,
        `${createdSplitsEvent.transactionHash}-${createdSplitsEvent.logIndex}`,
      );

      // This must be the only place a `SubList` is created.
      const [subList, isSubListCreated] = await SubListModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id: accountId,
        },
        defaults: {
          id: toImmutableSplitsDriverId(rawAccountId),
        },
      });

      if (!isSubListCreated) {
        // The `SubList` with the given `accountId` was created by another `CreatedSplits` event.
        unreachableError(`SubList with id ${accountId} already exists.`);
      }

      logManager
        .appendFindOrCreateLog(SubListModel, isSubListCreated, subList.id)
        .logAllInfo();

      logManager.logAllInfo();
    });
  }
}
