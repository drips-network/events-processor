import type { OwnerUpdateRequestedEvent as CurrentNetworkOwnerUpdateRequestedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import type { OwnerUpdateRequestedEvent as FilecoinOwnerUpdateRequestedEvent } from '../../contracts/filecoin/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import EventHandlerBase from '../events/EventHandlerBase';
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

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<
  | 'OwnerUpdateRequested(uint256,uint8,bytes,address)'
  | 'OwnerUpdateRequested(uint256,uint8,bytes)'
> {
  public readonly eventSignatures = [
    'OwnerUpdateRequested(uint256,uint8,bytes,address)' as const,
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const,
  ];

  protected async _handle(
    request: EventHandlerRequest<
      | 'OwnerUpdateRequested(uint256,uint8,bytes,address)'
      | 'OwnerUpdateRequested(uint256,uint8,bytes)'
    >,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, forge, name] = args as
      | CurrentNetworkOwnerUpdateRequestedEvent.OutputTuple
      | FilecoinOwnerUpdateRequestedEvent.OutputTuple;

    const repoDriverId = toRepoDriverId(accountId);
    const forgeAsString = toForge(forge);
    const decodedName = toReadable(name);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
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

  override async afterHandle(accountId: bigint): Promise<void> {
    const ownerAccountId = singleOrDefault(
      await GitProjectModel.findAll({
        where: {
          id: toRepoDriverId(accountId),
        },
      }),
    )?.ownerAccountId;

    super.afterHandle(...[accountId, ownerAccountId].filter(Boolean));
  }
}
