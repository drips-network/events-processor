import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import sequelizeInstance from '../db/getSequelizeInstance';
import type { KnownAny, HandleRequest } from '../common/types';
import { logRequestInfo } from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel } from '../models';
import { AccountIdUtils } from '../utils/AccountIdUtils';
import { GitProjectUtils } from '../utils/GitProjectUtils';
import LogManager from '../common/LogManager';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import isLatestEvent from '../utils/isLatestEvent';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdated(uint256,address)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

    const repoDriverAccountId =
      AccountIdUtils.repoDriverAccountIdFromBigInt(accountId);

    logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - owner:       ${owner}
      \r\t - accountId:   ${repoDriverAccountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
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
            accountId: repoDriverAccountId,
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
          id: repoDriverAccountId,
        },
        defaults: {
          ownerAddress: owner,
          id: repoDriverAccountId,
          verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
        },
      });

      if (isProjectCreated) {
        logManager
          .appendFindOrCreateLog(GitProjectModel, isProjectCreated, project.id)
          .logDebug();

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
        project.verificationStatus = GitProjectUtils.calculateStatus(project);

        logManager
          .appendIsLatestEventLog()
          .appendUpdateLog(project, GitProjectModel, project.id);

        await project.save({ transaction });

        logManager.logDebug();
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
