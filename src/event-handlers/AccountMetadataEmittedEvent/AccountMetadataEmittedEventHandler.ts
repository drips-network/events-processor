import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../../contracts/Drips';
import type { KnownAny, HandleRequest } from '../../common/types';

import sequelizeInstance from '../../db/getSequelizeInstance';
import EventHandlerBase from '../../common/EventHandlerBase';
import AccountMetadataEmittedEventModel from '../../models/AccountMetadataEmittedEventModel';
import saveEventProcessingJob from '../../queue/saveEventProcessingJob';
import { DRIPS_APP_USER_METADATA_KEY } from '../../common/constants';
import handleGitProjectMetadata from './gitProject/handleGitProjectMetadata';
import IsDripList from '../../utils/dripListUtils';
import LogManager from '../../common/LogManager';
import {
  isNftDriverId,
  isRepoDriverId,
  toAccountId,
} from '../../utils/accountIdUtils';
import { isLatestEvent } from '../../utils/eventUtils';
import { toIpfsHash } from '../../utils/metadataUtils';
import handleDripListMetadata from './dripList/handleDripListMetadata';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, key, value] =
      args as AccountMetadataEmittedEvent.OutputTuple;

    if (key !== DRIPS_APP_USER_METADATA_KEY) {
      LogManager.logRequestInfo(
        `Skipping ${this.eventSignature} event because the metadata were not emitted by the Drips App.`,
        requestId,
      );
      return;
    }

    const typedAccountId = toAccountId(accountId);
    const ipfsHash = toIpfsHash(value);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - key:         ${key}
      \r\t - value:       ${value} (ipfs hash: ${ipfsHash})
      \r\t - accountId:   ${typedAccountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [accountMetadataEmittedEventModel, isEventCreated] =
        await AccountMetadataEmittedEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            key,
            value,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            accountId: typedAccountId,
          },
        });

      logManager.appendFindOrCreateLog(
        AccountMetadataEmittedEventModel,
        isEventCreated,
        `${accountMetadataEmittedEventModel.transactionHash}-${accountMetadataEmittedEventModel.logIndex}`,
      );

      const isLatest = await isLatestEvent(
        accountMetadataEmittedEventModel,
        AccountMetadataEmittedEventModel,
        {
          logIndex,
          transactionHash,
        },
        transaction,
      );

      // `RepoDriver` account + Drips App metadata key => Git Project
      if (isRepoDriverId(typedAccountId) && isLatest) {
        logManager.appendIsLatestEventLog();
        await handleGitProjectMetadata(
          logManager,
          typedAccountId,
          transaction,
          ipfsHash,
        );
      }
      // `NftDriver` account + Drips App metadata key => Drip List
      else if (isNftDriverId(typedAccountId) && isLatest) {
        logManager.appendIsLatestEventLog();

        if (!(await IsDripList(typedAccountId, transaction))) {
          return;
        }
        await handleDripListMetadata(
          logManager,
          typedAccountId,
          transaction,
          ipfsHash,
        );
      }

      logManager.logAllDebug();
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
