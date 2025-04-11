import type { OwnerUpdateRequestedEvent as CurrentNetworkOwnerUpdateRequestedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import type { OwnerUpdateRequestedEvent as FilecoinOwnerUpdateRequestedEvent } from '../../contracts/filecoin/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import EventHandlerBase from '../events/EventHandlerBase';
import { ProjectModel } from '../models';
import LogManager from '../core/LogManager';
import { convertToRepoDriverId } from '../utils/accountIdUtils';
import { isLatestEvent } from '../utils/isLatestEvent';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { dbConnection } from '../db/database';
import { singleOrDefault } from '../utils/linq';
import {
  toForge,
  toReadable,
  toUrl,
  calculateProjectStatus,
} from '../utils/projectUtils';
import RecoverableError from '../utils/recoverableError';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<
  | 'OwnerUpdateRequested(uint256,uint8,bytes,address)'
  | 'OwnerUpdateRequested(uint256,uint8,bytes)'
> {
  public readonly eventSignatures = [
    'OwnerUpdateRequested(uint256,uint8,bytes,address)' as const,
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const,
  ];

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
  }: EventHandlerRequest<
    | 'OwnerUpdateRequested(uint256,uint8,bytes,address)'
    | 'OwnerUpdateRequested(uint256,uint8,bytes)'
  >): Promise<void> {
    const [accountId, forge, name] = args as
      | CurrentNetworkOwnerUpdateRequestedEvent.OutputTuple
      | FilecoinOwnerUpdateRequestedEvent.OutputTuple;

    const forgeAsString = toForge(forge);
    const decodedName = toReadable(name);

    LogManager.logRequestInfo(
      [
        `📥 ${this.name} is processing the following ${eventSignature}:`,
        `  - forge:       ${forgeAsString}`,
        `  - name:        ${decodedName}`,
        `  - accountId:   ${accountId}`,
        `  - logIndex:    ${logIndex}`,
        `  - blockNumber: ${blockNumber}`,
        `  - txHash:      ${transactionHash}`,
      ].join('\n'),
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const projectId = convertToRepoDriverId(accountId);

      const ownerUpdateRequestedEvent =
        await OwnerUpdateRequestedEventModel.create(
          {
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            name: decodedName,
            forge: forgeAsString,
            accountId: projectId,
          },
          { transaction },
        );

      logManager.appendFindOrCreateLog(
        OwnerUpdateRequestedEventModel,
        true,
        `${ownerUpdateRequestedEvent.transactionHash}-${ownerUpdateRequestedEvent.logIndex}`,
      );

      if (
        !(await isLatestEvent(
          ownerUpdateRequestedEvent,
          OwnerUpdateRequestedEventModel,
          {
            accountId,
          },
          transaction,
        ))
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

      project.name = decodedName;
      project.forge = forgeAsString;
      project.url = toUrl(forgeAsString, decodedName);
      project.verificationStatus = calculateProjectStatus(project);

      await project.save({ transaction });

      logManager.logAllInfo(this.name);
    });
  }

  override async afterHandle(context: {
    args: [accountId: bigint];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [accountId] = args;

    const ownerAccountId = singleOrDefault(
      await ProjectModel.findAll({
        where: {
          id: convertToRepoDriverId(accountId),
        },
      }),
    )?.ownerAccountId;

    super.afterHandle({
      args: [accountId, ownerAccountId],
      blockTimestamp,
    });
  }
}
