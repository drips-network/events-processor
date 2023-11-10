import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../../contracts/Drips';
import type { KnownAny } from '../../core/types';

import EventHandlerBase from '../../events/EventHandlerBase';
import saveEventProcessingJob from '../../queue/saveEventProcessingJob';
import { DRIPS_APP_USER_METADATA_KEY } from '../../core/constants';
import handleGitProjectMetadata from './gitProject/handleGitProjectMetadata';
import IsDripList from '../../utils/dripListUtils';
import LogManager from '../../core/LogManager';
import {
  isNftDriverId,
  isRepoDriverId,
  toAccountId,
} from '../../utils/accountIdUtils';
import { isLatestEvent } from '../../utils/eventUtils';
import { toIpfsHash } from '../../utils/metadataUtils';
import handleDripListMetadata from './dripList/handleDripListMetadata';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { AccountMetadataEmittedEventModel } from '../../models';
import { dbConnection } from '../../db/database';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, key, value] =
      args as AccountMetadataEmittedEvent.OutputTuple;

    if (!this._isEmittedByTheDripsApp(key)) {
      LogManager.logRequestInfo(
        `Skipping ${this.eventSignature} event processing because the key '${key}' is not emitted by the Drips App.`,
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
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
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

      // Assumption: `RepoDriverId` + metadata coming from the Drips App => the RepoDriverId represents a Project.
      if (isRepoDriverId(typedAccountId) && isLatest) {
        logManager.appendIsLatestEventLog();

        await handleGitProjectMetadata(
          logManager,
          typedAccountId,
          transaction,
          ipfsHash,
        );
      } else if (isNftDriverId(typedAccountId) && isLatest) {
        if (!(await IsDripList(typedAccountId, transaction))) {
          LogManager.logRequestInfo(
            `Skipping ${this.eventSignature} event processing because the NftDriverId '${typedAccountId}' is not a Drip List ID.`,
            requestId,
          );

          return;
        }

        logManager.appendIsLatestEventLog();

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

  private _isEmittedByTheDripsApp(key: string): boolean {
    if (key === DRIPS_APP_USER_METADATA_KEY) {
      return true;
    }

    return false;
  }
}
