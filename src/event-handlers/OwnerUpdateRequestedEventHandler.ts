import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../utils/getSequelizeInstance';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import {
  logRequestInfo,
  logRequestWarn,
  nameOfType,
} from '../utils/logRequest';
import { HandleRequest } from '../common/types';
import EventHandlerBase from '../common/EventHandlerBase';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public eventSignature = 'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;
    const { accountId, forge, name } = eventLog.args;

    logRequestInfo(
      this.name,
      `event data was accountId: ${accountId}, forge: ${forge}, name: ${ethers.toUtf8String(
        name,
      )}.`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      logRequestInfo(
        this.name,
        `creating a new ${nameOfType(
          OwnerUpdateRequestedEventModel,
        )} for the received event...`,
        requestId,
      );

      const [ownerUpdateRequestedEvent, created] =
        await OwnerUpdateRequestedEventModel.findOrCreate({
          transaction,
          requestId,
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
        } as any); // HACK: Necessary (in all handlers) for passing the `requestId` to sequelize Hooks.

      if (created) {
        logRequestInfo(
          this.name,
          `created a new ${nameOfType(
            OwnerUpdateRequestedEventModel,
          )} with ID ${ownerUpdateRequestedEvent.id}.`,
          requestId,
        );
      } else {
        logRequestWarn(
          this.name,
          `${nameOfType(OwnerUpdateRequestedEventModel)} with ID ${
            ownerUpdateRequestedEvent.id
          } already exists. Skipping...`,
          requestId,
        );
      }
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdateRequestedEvent.InputTuple,
      OwnerUpdateRequestedEvent.OutputTuple,
      OwnerUpdateRequestedEvent.OutputObject
    >
    // TODO: fix listener event type.
    // Incoming event type is 'any' (in ALL listeners) because of a bug in ethers.js.
    // It should be typed as TypedEventLog<TypedContractEvent<...>>, which is what TS infers by default.
    // When fixed, we won't need to pass event.log to `executeHandle`.
  > = async (_accountId, _forge, _name, eventLog) => {
    await this.executeHandle(new HandleRequest((eventLog as any).log));
  };
}
