import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import { EventHandlerBase } from '../common/EventHandlerBase';
import logger from '../common/logger';
import { HandleRequest } from '../common/types';
import {
  GitProjectModel,
  ProjectVerificationStatus,
} from '../models/GitProjectModel';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import executeDbTransaction from '../utils/execute-db-transaction';
import getEventOutput from '../utils/get-event-output';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  protected filterSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdated(uint256,address)'>,
  ) {
    const { eventLog, id: requestId } = request;

    const [accountId, owner] =
      await getEventOutput<OwnerUpdatedEvent.OutputTuple>(eventLog);

    await executeDbTransaction(async (transaction) => {
      await OwnerUpdatedEventModel.create(
        {
          accountId: accountId.toString(),
          ownerAddress: owner,
          logIndex: eventLog.index,
          blockNumber: eventLog.blockNumber,
          rawEvent: JSON.stringify(eventLog),
          transactionHash: eventLog.transactionHash,
          blockTimestamp: (await eventLog.getBlock()).date,
        },
        { transaction },
      );

      const gitProject = await GitProjectModel.findOne({
        where: {
          accountId: accountId.toString(),
        },
      });

      if (!gitProject) {
        throw new Error(
          `Git project with ID ${accountId} not found but it was expected to exist. Maybe the relevant event that creates the project was not processed yet. See logs for more details.`,
        );
      }

      logger.debug(
        `[${requestId}] updates Git project with ID ${gitProject.accountId} (${gitProject.repoName}) owner to ${owner}.`,
      );

      await GitProjectModel.update(
        {
          ownerAddress: owner,
          verificationStatus: ProjectVerificationStatus.AwaitingProjectMetadata,
          blockTimestamp: (await eventLog.getBlock()).date,
        },
        {
          where: {
            accountId: accountId.toString(),
          },
          transaction,
        },
      );
    }, requestId);

    logger.debug(`[${requestId}] Git project's owner updated.`);
  }

  protected readonly onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdatedEvent.InputTuple,
      OwnerUpdatedEvent.OutputTuple,
      OwnerUpdatedEvent.OutputObject
    >
    // TODO: fix 'on' listener event type.
    // Incoming event type is 'any' (in ALL listeners) because of a bug in ethers.js.
    // It should be typed as TypedEventLog<TypedContractEvent<...>>, which is what TS infers by default.
    // When fixed, we won't need to pass event.log to `executeHandle`.
  > = async (_accountId, _owner, ev: any) =>
    this.executeHandle(new HandleRequest((ev as any).log));
}
