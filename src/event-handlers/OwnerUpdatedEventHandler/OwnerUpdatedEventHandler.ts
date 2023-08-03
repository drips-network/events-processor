import type { OwnerUpdatedEvent } from '../../../contracts/RepoDriver';
import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import { EventHandlerBase } from '../../common/EventHandlerBase';
import { HandleRequest } from '../../common/types';
import type { IGitProjectAttributes } from '../../models/GitProjectModel';
import {
  GitProjectModelDefinition,
  ProjectVerificationStatus,
} from '../../models/GitProjectModel';
import executeDbTransaction from '../../utils/execute-db-transaction';
import getEventOutput from '../../utils/get-event-output';
import {
  OwnerUpdatedEventModelDefinition,
  type IOwnerUpdatedEventAttributes,
} from './OwnerUpdatedEventModel';
import logger from '../../common/logger';

export type OwnerUpdatedEventGitProjectAttributes = Omit<
  IGitProjectAttributes,
  'repoNameBytes' | 'forge' | 'repoName' | 'id'
> & {
  verificationStatus: ProjectVerificationStatus.AwaitingProjectMetadata;
};

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  protected filterSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdated(uint256,address)'>,
  ) {
    const { eventLog, id: requestId } = request;

    const [accountId, owner] =
      await getEventOutput<OwnerUpdatedEvent.OutputTuple>(eventLog);

    await executeDbTransaction(async (transaction) => {
      await OwnerUpdatedEventModelDefinition.model.create(
        {
          accountId: accountId.toString(),
          ownerAddress: owner,
          logIndex: eventLog.index,
          blockNumber: eventLog.blockNumber,
          rawEvent: JSON.stringify(eventLog),
          transactionHash: eventLog.transactionHash,
          blockTimestamp: (await eventLog.getBlock()).date,
        } satisfies IOwnerUpdatedEventAttributes,
        { transaction },
      );

      const gitProject = await GitProjectModelDefinition.model.findOne({
        where: {
          id: accountId.toString(),
        },
      });

      if (!gitProject) {
        throw new Error(
          `Git project with ID ${accountId} not found but it was expected to exist. Maybe the relevant event that creates the project was not processed yet. See logs for more details.`,
        );
      }

      logger.debug(
        `Request ${requestId} updates Git project ${gitProject.id} (${gitProject.repoName}) owner to ${owner}.`,
      );

      await GitProjectModelDefinition.model.update(
        {
          ownerAddress: owner,
          verificationStatus: ProjectVerificationStatus.AwaitingProjectMetadata,
          blockTimestamp: (await eventLog.getBlock()).date,
        } satisfies OwnerUpdatedEventGitProjectAttributes,
        {
          where: {
            id: accountId.toString(),
          },
          transaction,
        },
      );
    }, requestId);
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
