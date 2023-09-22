import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../db/getSequelizeInstance';
import type { KnownAny, HandleRequest } from '../common/types';
import EventHandlerBase from '../common/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel } from '../models';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import {
  calculateProjectStatus,
  toForge,
  toReadable,
} from '../utils/gitProjectUtils';
import LogManager from '../common/LogManager';
import { toRepoDriverId } from '../utils/accountIdUtils';
import { isLatestEvent } from '../utils/eventUtils';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public readonly eventSignature =
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, forge, name] =
      args as OwnerUpdateRequestedEvent.OutputTuple;

    const repoDriverId = toRepoDriverId(accountId);
    const forgeAsString = toForge(forge);
    const decodedName = toReadable(name);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - forge:       ${forgeAsString}
      \r\t - name:        ${decodedName}
      \r\t - accountId:   ${repoDriverId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [ownerUpdateRequestedEvent, isEventCreated] =
        await OwnerUpdateRequestedEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            name: decodedName,
            forge: forgeAsString,
            accountId: repoDriverId,
          },
        });

      logManager.appendFindOrCreateLog(
        OwnerUpdateRequestedEventModel,
        isEventCreated,
        `${ownerUpdateRequestedEvent.transactionHash}-${ownerUpdateRequestedEvent.logIndex}`,
      );

      const [project, isProjectCreated] = await GitProjectModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id: repoDriverId,
        },
        defaults: {
          name: decodedName,
          forge: forgeAsString,
          id: repoDriverId,
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
        ownerUpdateRequestedEvent,
        OwnerUpdateRequestedEventModel,
        {
          logIndex,
          transactionHash,
        },
        transaction,
      );

      if (isLatest) {
        project.name = decodedName;
        project.forge = forgeAsString;
        project.verificationStatus = calculateProjectStatus(project);

        logManager
          .appendIsLatestEventLog()
          .appendUpdateLog(project, GitProjectModel, project.id);

        await project.save({ transaction });

        logManager.logDebug();
      }
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdateRequestedEvent.InputTuple,
      OwnerUpdateRequestedEvent.OutputTuple,
      OwnerUpdateRequestedEvent.OutputObject
    >
    // TODO: change `eventLog` type.
    // Until ethers/typechain fixes the related bug, the received `eventLog` is typed as 'any' (in ALL listeners).
    // It should be of `TypedEventLog<TypedContractEvent<...>>`, which TS infers by default.
    // When fixed, we won't need to pass event.log to `executeHandle`.
  > = async (_accountId, _forge, _name, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
