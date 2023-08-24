import type { OwnerUpdatedEvent } from '../../contracts/RepoDriver';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import { EventHandlerBase } from '../common/EventHandlerBase';
import logger from '../common/logger';
import { HandleRequest } from '../common/types';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import parseEventOutput from '../utils/parse-event-output';
import sequelizeInstance from '../utils/get-sequelize-instance';
import shouldNeverHappen from '../utils/throw';
import GitProjectModel from '../models/GitProjectModel';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  protected filterSignature = 'OwnerUpdated(uint256,address)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdated(uint256,address)'>,
  ) {
    await sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;
      const [accountId, owner] =
        await parseEventOutput<OwnerUpdatedEvent.OutputTuple>(eventLog);

      const [ownerUpdatedEventModel, created] =
        await OwnerUpdatedEventModel.findOrCreate({
          transaction,
          where: {
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            transactionHash: eventLog.transactionHash,
          },
          defaults: {
            accountId: accountId.toString(),
            owner,
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
          `[${requestId}] already processed event with ID ${ownerUpdatedEventModel.id}. Skipping...`,
        );
        return;
      }

      const gitProject = await GitProjectModel.findOne({
        where: {
          accountId: accountId.toString(),
        },
      });

      if (!gitProject) {
        throw new Error(
          `Git project with ID ${accountId} not found but it was expected to exist. Maybe the relevant event that creates the project was not processed yet. See logs for more details.`,
        );
      }

      await gitProject.update(
        {
          owner,
        },
        { transaction },
      );

      logger.debug(
        `[${requestId}] updated Git project with ID ${gitProject.accountId} (${gitProject.name}) owner to ${owner}.`,
      );
    });
  }

  protected readonly onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdatedEvent.InputTuple,
      OwnerUpdatedEvent.OutputTuple,
      OwnerUpdatedEvent.OutputObject
    >
    // TODO: fix 'on' listener event type.
    // Incoming event type is 'any' (in ALL listeners) because of a bug in ethers.js.
    // It should be typed as TypedEventLog<TypedContractEvent<...>>, which is what TS infers by default.
    // When fixed, we won't need to pass event.log to `executeHandle`.
  > = async (_accountId, _owner, ev: any) =>
    this.executeHandle(new HandleRequest((ev as any).log));
}
