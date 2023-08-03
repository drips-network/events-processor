import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../../contracts/RepoDriver';
import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import { EventHandlerBase } from '../../common/EventHandlerBase';
import {
  OwnerUpdateRequestedEventModelDefinition,
  type IOwnerUpdateRequestedEventAttributes,
} from './OwnerUpdateRequestedEventModel';
import type { IGitProjectAttributes } from '../../models/GitProjectModel';
import {
  GitProjectModelDefinition,
  ProjectVerificationStatus,
} from '../../models/GitProjectModel';
import { HandleRequest } from '../../common/types';
import getEventOutput from '../../utils/get-event-output';
import executeDbTransaction from '../../utils/execute-db-transaction';
import logger from '../../common/logger';

type OwnerUpdateRequestedGitProjectAttributes = Omit<
  IGitProjectAttributes,
  'ownerAddress'
> & {
  verificationStatus:
    | ProjectVerificationStatus.NotStarted
    | ProjectVerificationStatus.ClaimingProject;
};

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public filterSignature = 'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;

    const [accountId, forge, name] =
      await getEventOutput<OwnerUpdateRequestedEvent.OutputTuple>(eventLog);

    return executeDbTransaction(async (transaction) => {
      await OwnerUpdateRequestedEventModelDefinition.model.create(
        {
          accountId: accountId.toString(),
          forge: Number(forge),
          name,
          logIndex: eventLog.index,
          blockNumber: eventLog.blockNumber,
          rawEvent: JSON.stringify(eventLog),
          blockTimestamp: (await eventLog.getBlock()).date,
          transactionHash: eventLog.transactionHash,
        } satisfies IOwnerUpdateRequestedEventAttributes,
        { transaction },
      );

      logger.debug(
        `Request ${
          request.id
        } creates a new Git project with name ${ethers.toUtf8String(
          name,
        )}, forge ${Number(forge)} and accountId ${accountId}.`,
      );

      await GitProjectModelDefinition.model.create(
        {
          repoNameBytes: name,
          forge: Number(forge),
          id: accountId.toString(),
          repoName: ethers.toUtf8String(name),
          verificationStatus: ProjectVerificationStatus.ClaimingProject,
          blockTimestamp: (await eventLog.getBlock()).date,
        } satisfies OwnerUpdateRequestedGitProjectAttributes,
        { transaction },
      );
    }, requestId);
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdateRequestedEvent.InputTuple,
      OwnerUpdateRequestedEvent.OutputTuple,
      OwnerUpdateRequestedEvent.OutputObject
    >
  > = async (_accountId, _forge, _name, eventLog) => {
    await this.executeHandle(new HandleRequest((eventLog as any).log));
  };
}
