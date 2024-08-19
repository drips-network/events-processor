import type { OwnerUpdatedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import { GitProjectModel, OwnerUpdatedEventModel } from '../models';
import LogManager from '../core/LogManager';
import { calcAccountId, toRepoDriverId } from '../utils/accountIdUtils';
import { calculateProjectStatus } from '../utils/gitProjectUtils';
import { isLatestEvent } from '../utils/eventUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import { dbConnection } from '../db/database';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignatures = ['OwnerUpdated(uint256,address)' as const];

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
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - owner:       ${owner}
      \r\t - accountId:   ${repoDriverId}
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

      // Depending on the order of processing, a project can be created:
      // - By a `OwnerUpdateRequested` event.
      // - By a `OwnerUpdated` event.
      // - By an `AccountMetadataEmitted` event, as a (non existing in the DB) Project dependency of the account that emitted the metadata.
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
          claimedAt: blockTimestamp,
          ownerAccountId: await calcAccountId(owner),
          verificationStatus: ProjectVerificationStatus.OwnerUpdated,
        },
      });

      if (isProjectCreated) {
        logManager
          .appendFindOrCreateLog(GitProjectModel, isProjectCreated, project.id)
          .logAllInfo();

        return;
      }

      // Here, the Project already exists.
      // Only if the event is the latest (in the DB), we process the metadata.
      // After all events are processed, the Project will be updated with the latest values.
      if (
        !isLatestEvent(
          ownerUpdatedEvent,
          OwnerUpdatedEventModel,
          {
            logIndex,
            transactionHash,
            accountId: repoDriverId,
          },
          transaction,
        )
      ) {
        logManager.logAllInfo();

        return;
      }

      project.ownerAddress = owner;
      project.claimedAt = blockTimestamp;
      project.ownerAccountId = (await calcAccountId(owner)) ?? null;
      project.verificationStatus = calculateProjectStatus(project);

      logManager
        .appendIsLatestEventLog()
        .appendUpdateLog(project, GitProjectModel, project.id);

      await project.save({ transaction });

      logManager.logAllInfo();
    });
  }

  override async afterHandle(accountId: bigint, owner: string): Promise<void> {
    const ownerAccountId = await calcAccountId(owner);

    super.afterHandle(...[accountId, ownerAccountId]);
  }
}
