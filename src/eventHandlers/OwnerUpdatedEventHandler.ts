import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { KnownAny } from '../core/types';
import EventHandlerBase from '../events/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel, OwnerUpdatedEventModel } from '../models';
import LogManager from '../core/LogManager';
import { getOwnerAccountId, toRepoDriverId } from '../utils/accountIdUtils';
import { calculateProjectStatus } from '../utils/gitProjectUtils';
import { isLatestEvent } from '../utils/eventUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import { dbConnection } from '../db/database';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: EventHandlerRequest<'OwnerUpdated(uint256,address)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

    const repoDriverId = toRepoDriverId(accountId);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - owner:       ${owner}
      \r\t - accountId:   ${repoDriverId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [ownerUpdatedEvent, isEventCreated] =
        await OwnerUpdatedEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            owner,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            accountId: repoDriverId,
          },
        });

      logManager.appendFindOrCreateLog(
        OwnerUpdatedEventModel,
        isEventCreated,
        `${ownerUpdatedEvent.transactionHash}-${ownerUpdatedEvent.logIndex}`,
      );

      const [project, isProjectCreated] = await GitProjectModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id: repoDriverId,
        },
        defaults: {
          id: repoDriverId,
          isValid: true, // There are no receivers yet, so the project is valid.
          ownerAddress: owner,
          ownerAccountId: await getOwnerAccountId(owner),
          verificationStatus: ProjectVerificationStatus.OwnerUpdated,
        },
      });

      if (isProjectCreated) {
        logManager
          .appendFindOrCreateLog(GitProjectModel, isProjectCreated, project.id)
          .logAllDebug();

        return;
      }

      const isLatest = await isLatestEvent(
        ownerUpdatedEvent,
        OwnerUpdatedEventModel,
        {
          logIndex,
          transactionHash,
        },
        transaction,
      );

      if (isLatest) {
        project.ownerAddress = owner;
        project.ownerAccountId = (await getOwnerAccountId(owner)) ?? null;
        project.verificationStatus = calculateProjectStatus(project);

        logManager
          .appendIsLatestEventLog()
          .appendUpdateLog(project, GitProjectModel, project.id);

        await project.save({ transaction });

        logManager.logAllDebug();
      }
    });
  }

  protected readonly onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdatedEvent.InputTuple,
      OwnerUpdatedEvent.OutputTuple,
      OwnerUpdatedEvent.OutputObject
    >
  > = async (_accountId, _owner, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
