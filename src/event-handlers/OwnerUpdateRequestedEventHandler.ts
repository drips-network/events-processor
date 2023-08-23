import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import { EventHandlerBase } from '../common/EventHandlerBase';
import logger from '../common/logger';
import { HandleRequest } from '../common/types';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import getEventOutput from '../utils/get-event-output';
import {
  Forge,
  GitProjectModel,
  ProjectVerificationStatus,
} from '../models/GitProjectModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../utils/get-sequelize-instance';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public filterSignature = 'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;

    const [accountId, forge, name] =
      await getEventOutput<OwnerUpdateRequestedEvent.OutputTuple>(eventLog);

    return sequelizeInstance.transaction(async (transaction) => {
      const [ownerUpdateRequestedEvent, created] =
        await OwnerUpdateRequestedEventModel.findOrCreate({
          transaction,
          where: {
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            transactionHash: eventLog.transactionHash,
          },
          defaults: {
            name,
            forge: Number(forge),
            accountId: accountId.toString(),
            rawEvent: JSON.stringify(eventLog),
            blockTimestamp: (await eventLog.getBlock()).date,
          },
        });

      if (!created) {
        logger.info(
          `[${requestId}] already processed event with ID ${ownerUpdateRequestedEvent.id}. Skipping...`,
        );
        return;
      }

      await GitProjectModel.create(
        {
          forge: Forge[Number(forge)],
          accountId: accountId.toString(),
          repoName: ethers.toUtf8String(name),
          verificationStatus:
            ProjectVerificationStatus.OwnerVerificationRequested,
        },
        { transaction },
      );

      logger.debug(
        `[${requestId}] created a new Git project with name ${ethers.toUtf8String(
          name,
        )}, forge ${Forge[Number(forge)]} and accountId ${accountId}.`,
      );
    });
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
