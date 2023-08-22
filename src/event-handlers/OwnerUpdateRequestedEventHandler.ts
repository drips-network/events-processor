import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import { EventHandlerBase } from '../common/EventHandlerBase';
import logger from '../common/logger';
import { HandleRequest } from '../common/types';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import executeDbTransaction from '../utils/execute-db-transaction';
import getEventOutput from '../utils/get-event-output';
import {
  Forge,
  GitProjectModel,
  ProjectVerificationStatus,
} from '../models/GitProjectModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public filterSignature = 'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;

    const [accountId, forge, name] =
      await getEventOutput<OwnerUpdateRequestedEvent.OutputTuple>(eventLog);

    return executeDbTransaction(async (transaction) => {
      await OwnerUpdateRequestedEventModel.create(
        {
          accountId: accountId.toString(),
          forge: Number(forge),
          name,
          logIndex: eventLog.index,
          blockNumber: eventLog.blockNumber,
          rawEvent: JSON.stringify(eventLog),
          blockTimestamp: (await eventLog.getBlock()).date,
          transactionHash: eventLog.transactionHash,
        },
        { transaction },
      );

      logger.debug(
        `[${requestId}] creating a new Git project with name ${ethers.toUtf8String(
          name,
        )}, forge ${Forge[Number(forge)]} and accountId ${accountId}.`,
      );

      await GitProjectModel.create(
        {
          repoNameBytes: name,
          forge: Number(forge),
          accountId: accountId.toString(),
          repoName: ethers.toUtf8String(name),
          verificationStatus: ProjectVerificationStatus.ClaimingProject,
          blockTimestamp: (await eventLog.getBlock()).date,
        },
        { transaction },
      );

      logger.debug(`[${requestId}] Git project created.`);
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
