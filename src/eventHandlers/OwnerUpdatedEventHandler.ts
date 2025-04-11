import type { OwnerUpdatedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import { ProjectModel, OwnerUpdatedEventModel } from '../models';
import LogManager from '../core/LogManager';
import { calcAccountId, convertToRepoDriverId } from '../utils/accountIdUtils';
import { isLatestEvent } from '../utils/isLatestEvent';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { dbConnection } from '../db/database';
import { calculateProjectStatus } from '../utils/projectUtils';
import RecoverableError from '../utils/recoverableError';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignatures = ['OwnerUpdated(uint256,address)' as const];

  protected async _handle({
    id: requestId,
    event: {
      args,
      logIndex,
      blockNumber,
      blockTimestamp,
      transactionHash,
      eventSignature,
    },
  }: EventHandlerRequest<'OwnerUpdated(uint256,address)'>): Promise<void> {
    const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

    LogManager.logRequestInfo(
      [
        `📥 ${this.name} is processing the following ${eventSignature}:`,
        `  - owner:        ${owner}`,
        `  - accountId:    ${accountId}`,
        `  - logIndex:     ${logIndex}`,
        `  - blockNumber:  ${blockNumber}`,
        `  - txHash:       ${transactionHash}`,
      ].join('\n'),
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const projectId = convertToRepoDriverId(accountId);

      const ownerUpdatedEvent = await OwnerUpdatedEventModel.create(
        {
          owner,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: projectId,
        },
        { transaction },
      );

      logManager.appendFindOrCreateLog(
        OwnerUpdatedEventModel,
        true,
        `${ownerUpdatedEvent.transactionHash}-${ownerUpdatedEvent.logIndex}`,
      );

      // Only process event further if this is the latest.
      if (
        !isLatestEvent(
          ownerUpdatedEvent,
          OwnerUpdatedEventModel,
          {
            accountId: projectId,
          },
          transaction,
        )
      ) {
        logManager.logAllInfo(this.name);

        return;
      }

      const project = await ProjectModel.findByPk(projectId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!project) {
        throw new RecoverableError(
          `Project ${projectId} not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
        );
      }

      project.ownerAddress = owner;
      project.claimedAt = blockTimestamp;
      project.ownerAccountId = await calcAccountId(owner);
      project.verificationStatus = calculateProjectStatus(project);

      logManager.appendUpdateLog(project, ProjectModel, project.id);

      await project.save({ transaction });

      logManager.logAllInfo(this.name);
    });
  }

  override async afterHandle(context: {
    args: [accountId: bigint, owner: string];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [accountId, owner] = args;

    const ownerAccountId = await calcAccountId(owner);

    super.afterHandle({
      args: [accountId, ownerAccountId],
      blockTimestamp,
    });
  }
}
