import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../db/getSequelizeInstance';
import {
  logRequestDebug,
  logRequestInfo,
  nameOfType,
} from '../utils/logRequest';
import type { KnownAny, HandleContext } from '../common/types';
import EventHandlerBase from '../common/EventHandlerBase';
import { FORGES_MAP } from '../common/constants';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { GitProjectModel } from '../models';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import { assertRepoDiverAccountId } from '../utils/assert';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public readonly eventSignature =
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleContext<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { event, id: requestId } = request;
    const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
      event;
    const [accountId, forge, name] =
      args as OwnerUpdateRequestedEvent.OutputTuple;

    const logs: string[] = [];

    const forgeAsString = FORGES_MAP[Number(forge) as keyof typeof FORGES_MAP];
    const projectId = accountId.toString();
    assertRepoDiverAccountId(projectId);

    logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - forge:       ${forgeAsString}
      \r\t - name:        ${ethers.toUtf8String(name)}
      \r\t - accountId:   ${accountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const ownerUpdateRequestedEvent =
        await OwnerUpdateRequestedEventModel.create(
          {
            name,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            forge: forgeAsString,
            accountId: projectId,
          },
          { transaction },
        );

      logs.push(
        `Created a new ${nameOfType(OwnerUpdateRequestedEventModel)} with ID ${
          ownerUpdateRequestedEvent.transactionHash
        }-${ownerUpdateRequestedEvent.logIndex}.`,
      );

      const [project, created] = await GitProjectModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id: projectId,
        },
        defaults: {
          id: projectId,
          splitsJson: null,
          forge: forgeAsString,
          name: ethers.toUtf8String(name),
          verificationStatus: ProjectVerificationStatus.Started,
        },
      });

      logs.push(
        `${
          created
            ? `Created a new 💻 ${nameOfType(GitProjectModel)} with ID ${
                project.id
              }, forge ${project.forge} and name ${project.name}.`
            : `Git Project with ID ${project.id} already exists. Probably, it was created by another event. Skipping creation.`
        }`,
      );

      logRequestDebug(
        `Completed successfully. The following changes occurred:\n\t - ${logs.join(
          '\n\t - ',
        )}`,
        requestId,
      );
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
