import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import { EventHandlerBase } from '../common/EventHandlerBase';
import logger from '../common/logger';
import { HandleRequest } from '../common/types';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import parseEventOutput from '../utils/parse-event-output';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../utils/get-sequelize-instance';
import shouldNeverHappen from '../utils/throw';
import GitProjectModel, {
  Forge,
  ProjectVerificationStatus,
} from '../models/GitProjectModel';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public filterSignature = 'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    return sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;

      const [accountId, forge, name] =
        await parseEventOutput<OwnerUpdateRequestedEvent.OutputTuple>(eventLog);

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
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            blockTimestamp:
              (await eventLog.getBlock()).date ?? shouldNeverHappen(),
            transactionHash: eventLog.transactionHash,
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
          forge: Number(forge),
          accountId: accountId.toString(),
          name: ethers.toUtf8String(name),
          verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
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
