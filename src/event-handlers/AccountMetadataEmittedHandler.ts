import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import { HandleRequest } from '../common/types';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEventModel';

import sequelizeInstance from '../utils/getSequelizeInstance';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import {
  logRequestInfo,
  logRequestWarn,
  nameOfType,
} from '../utils/logRequest';
import EventHandlerBase from '../common/EventHandlerBase';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;
      const { accountId, key, value } =
        eventLog.args as AccountMetadataEmittedEvent.OutputObject;

      logRequestInfo(
        this.name,
        `event data was accountId: ${accountId}, key: ${key}, value: ${value}}.`,
        requestId,
      );

      const [accountMetadataEmittedEventModel, created] =
        await AccountMetadataEmittedEventModel.findOrCreate({
          transaction,
          requestId,
          where: {
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            transactionHash: eventLog.transactionHash,
          },
          defaults: {
            key,
            value,
            logIndex: eventLog.index,
            accountId: accountId.toString(),
            blockNumber: eventLog.blockNumber,
            rawEvent: JSON.stringify(eventLog),
            blockTimestamp:
              (await eventLog.getBlock()).date ?? shouldNeverHappen(),
            transactionHash: eventLog.transactionHash,
          },
        } as any);

      if (created) {
        logRequestInfo(
          this.name,
          `created a new ${nameOfType(
            AccountMetadataEmittedEventModel,
          )} with ID ${accountMetadataEmittedEventModel.id}.`,
          requestId,
        );
      } else {
        logRequestWarn(
          this.name,
          `${nameOfType(AccountMetadataEmittedEventModel)} with ID ${
            accountMetadataEmittedEventModel.id
          } already exists. Skipping...`,
          requestId,
        );
      }
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) => {
    await this.executeHandle(new HandleRequest((eventLog as any).log));
  };
}
