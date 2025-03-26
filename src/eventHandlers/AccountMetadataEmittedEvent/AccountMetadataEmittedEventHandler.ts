import type { AccountMetadataEmittedEvent } from '../../../contracts/CURRENT_NETWORK/Drips';
import type { AccountId } from '../../core/types';

import EventHandlerBase from '../../events/EventHandlerBase';
import { DRIPS_APP_USER_METADATA_KEY } from '../../core/constants';
import handleGitProjectMetadata from './gitProject/handleGitProjectMetadata';
import LogManager from '../../core/LogManager';
import {
  isImmutableSplitsDriverId,
  isNftDriverId,
  isRepoDriverId,
  toAccountId,
} from '../../utils/accountIdUtils';
import { isLatestEvent } from '../../utils/eventUtils';
import getNftDriverMetadata, { toIpfsHash } from '../../utils/metadataUtils';
import handleDripListMetadata from './dripList/handleDripListMetadata';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { AccountMetadataEmittedEventModel } from '../../models';
import { dbConnection } from '../../db/database';
import { getCurrentSplitsByAccountId } from '../../utils/getCurrentSplits';
import handleEcosystemMetadata from './handleEcosystemMetadata';
import handleSubListMetadata from './handleSubListMetadata';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignatures = [
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const,
  ];

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
        `Skipping ${request.event.eventSignature} event processing because the key '${key}' is not emitted by the Drips App.`,
        requestId,
      );

      return;
    }

    const typedAccountId = toAccountId(accountId);
    const ipfsHash = toIpfsHash(value);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - key:         ${key}
      \r\t - value:       ${value} (ipfs hash: ${ipfsHash})
      \r\t - accountId:   ${typedAccountId}
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

      // Only if the event is the latest (in the DB), we process the metadata.

      if (
        !(await isLatestEvent(
          accountMetadataEmittedEventModel,
          AccountMetadataEmittedEventModel,
          {
            logIndex,
            transactionHash,
            accountId: typedAccountId,
          },
          transaction,
        ))
      ) {
        logManager.logAllInfo();

        return;
      }

      logManager.appendIsLatestEventLog();

      // The metadata are related to a Project.
      if (isRepoDriverId(typedAccountId)) {
        await handleGitProjectMetadata(
          logManager,
          typedAccountId,
          transaction,
          ipfsHash,
          blockTimestamp,
        );
      }
      // The metadata are related to either a Drip List or an Ecosystem.
      else if (isNftDriverId(typedAccountId)) {
        const metadata = await getNftDriverMetadata(ipfsHash);

        if (metadata.isDripList) {
          // Legacy metadata version.
          await handleDripListMetadata({
            ipfsHash,
            metadata,
            logManager,
            transaction,
            blockNumber,
            blockTimestamp,
            dripListId: typedAccountId,
          });
        } else if ('type' in metadata) {
          if (metadata.type === 'dripList') {
            // Current metadata version.
            await handleDripListMetadata({
              ipfsHash,
              metadata,
              logManager,
              transaction,
              blockNumber,
              blockTimestamp,
              dripListId: typedAccountId,
            });
          } else {
            await handleEcosystemMetadata();
          }
        }
      } else if (isImmutableSplitsDriverId(typedAccountId)) {
        await handleSubListMetadata();
      } else {
        logManager.appendLog(
          `Skipping metadata processing because the account with ID ${typedAccountId} is not a Project, Drip List, or Ecosystem.`,
        );
      }

      logManager.logAllInfo();
    });
  }

  public override async beforeHandle(
    request: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    const {
      event: { args },
    } = request;

    const [accountId] = args as AccountMetadataEmittedEvent.OutputTuple;

    const typedAccountId = toAccountId(accountId);

    return {
      accountIdsToInvalidate: await getCurrentSplitsByAccountId(typedAccountId),
    };
  }

  private _isEmittedByTheDripsApp(key: string): boolean {
    return key === DRIPS_APP_USER_METADATA_KEY;
  }
}
