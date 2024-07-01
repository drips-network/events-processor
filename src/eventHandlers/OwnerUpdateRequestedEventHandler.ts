import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { KnownAny } from '../core/types';
import EventHandlerBase from '../events/EventHandlerBase';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel } from '../models';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import {
  calculateProjectStatus,
  toForge,
  toReadable,
  toUrl,
} from '../utils/gitProjectUtils';
import LogManager from '../core/LogManager';
import { toRepoDriverId } from '../utils/accountIdUtils';
import { isLatestEvent } from '../utils/eventUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { dbConnection } from '../db/database';
import { singleOrDefault } from '../utils/linq';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public readonly eventSignature =
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: EventHandlerRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
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
      \r\t - accountId:   ${repoDriverId}
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
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
          name: decodedName,
          forge: forgeAsString,
          url: toUrl(forgeAsString, decodedName),
          verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
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
        !(await isLatestEvent(
          ownerUpdateRequestedEvent,
          OwnerUpdateRequestedEventModel,
          {
            logIndex,
            transactionHash,
            accountId,
          },
          transaction,
        ))
      ) {
        logManager.logAllInfo();

        return;
      }

      project.name = decodedName;
      project.forge = forgeAsString;
      project.url = toUrl(forgeAsString, decodedName);
      project.verificationStatus = calculateProjectStatus(project);

      logManager
        .appendIsLatestEventLog()
        .appendUpdateLog(project, GitProjectModel, project.id);

      await project.save({ transaction });

      logManager.logAllInfo();
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

  override async afterHandle(context: {
    args: [accountId: bigint];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [accountId] = args;

    const ownerAccountId = singleOrDefault(
      await GitProjectModel.findAll({
        where: {
          id: toRepoDriverId(accountId),
        },
      }),
    )?.ownerAccountId;

    super.afterHandle({
      args: [accountId, ownerAccountId],
      blockTimestamp,
    });
  }
}
