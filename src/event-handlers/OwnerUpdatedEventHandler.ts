import type { Transaction } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import sequelizeInstance from '../db/getSequelizeInstance';
import type { KnownAny, HandleContext, ProjectId } from '../common/types';
import {
  logRequestDebug,
  logRequestInfo,
  nameOfType,
} from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel } from '../models';
import { assertRepoDiverAccountId } from '../utils/assert';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleContext<'OwnerUpdated(uint256,address)'>,
  ): Promise<void> {
    const { event, id: requestId } = request;
    const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
      event;
    const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

    const logs: string[] = [];

    const projectId = accountId.toString();
    assertRepoDiverAccountId(projectId);

    logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - owner:       ${owner}
      \r\t - accountId:   ${accountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const ownerUpdatedEvent = await OwnerUpdatedEventModel.create(
        {
          owner,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: projectId,
        },
        {
          transaction,
        },
      );

      logs.push(
        `Created a new ${nameOfType(OwnerUpdatedEventModel)} with ID ${
          ownerUpdatedEvent.transactionHash
        }-${ownerUpdatedEvent.logIndex}.`,
      );

      if (await this._isLatestEvent(ownerUpdatedEvent, transaction)) {
        await this._updateProjectOwner(projectId, owner, transaction, logs);
      }

      logRequestDebug(
        `Completed successfully. The following changes occurred:\n\t - ${logs.join(
          '\n\t - ',
        )}`,
        requestId,
      );
    });
  }

  private async _updateProjectOwner(
    projectId: ProjectId,
    newOwnerAddress: AddressLike,
    transaction: Transaction,
    logs: string[],
  ): Promise<void> {
    const project = await GitProjectModel.findByPk(projectId, {
      transaction,
      lock: true,
    });

    if (!project) {
      throw new Error(
        `Git Project with ID ${project} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`,
      );
    }

    const previousOwnerAddress = project.ownerAddress;
    project.ownerAddress = newOwnerAddress;
    project.verificationStatus = GitProjectModel.calculateStatus(project);

    await project.save({ transaction });

    logs.push(
      `Incoming event was the latest for project ${projectId}. Project owner was updated from ${previousOwnerAddress} to ${project.ownerAddress} and the verification status was set to ${project.verificationStatus}.`,
    );
  }

  private async _isLatestEvent(
    instance: OwnerUpdatedEventModel,
    transaction: Transaction,
  ): Promise<boolean> {
    const latestEvent = await OwnerUpdatedEventModel.findOne({
      where: {
        accountId: instance.accountId,
      },
      order: [
        ['blockNumber', 'DESC'],
        ['logIndex', 'DESC'],
      ],
      transaction,
      lock: true,
    });

    if (!latestEvent) {
      return true;
    }

    if (
      latestEvent.blockNumber > instance.blockNumber ||
      (latestEvent.blockNumber === instance.blockNumber &&
        latestEvent.logIndex > instance.logIndex)
    ) {
      return false;
    }

    return true;
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
