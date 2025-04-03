import type { AnyVersion } from '@efstajas/versioned-parser';
import type { AccountMetadataEmittedEvent } from '../../../contracts/CURRENT_NETWORK/Drips';
import type { AccountId } from '../../core/types';

import EventHandlerBase from '../../events/EventHandlerBase';
import { DRIPS_APP_USER_METADATA_KEY } from '../../core/constants';
import handleProjectMetadata from './handlers/handleProjectMetadata';
import LogManager from '../../core/LogManager';
import {
  isImmutableSplitsDriverId,
  isNftDriverId,
  isRepoDriverId,
  toAccountId,
} from '../../utils/accountIdUtils';
import { getNftDriverMetadata, toIpfsHash } from '../../utils/metadataUtils';
import handleDripListMetadata from './handlers/handleDripListMetadata';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { AccountMetadataEmittedEventModel } from '../../models';
import { dbConnection } from '../../db/database';
import { getCurrentSplitsByAccountId } from '../../utils/getCurrentSplits';
import handleEcosystemMetadata from './handlers/handleEcosystemMetadata';
import handleSubListMetadata from './handlers/handleSubListMetadata';
import type { nftDriverAccountMetadataParser } from '../../metadata/schemas';

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
      [
        `📥 ${this.name} is processing ${request.event.eventSignature}:`,
        `  - key:        ${key}`,
        `  - value:      ${value} (IPFS hash: ${ipfsHash})`,
        `  - accountId:  ${accountId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
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

      let handled = false;

      if (isRepoDriverId(typedAccountId)) {
        await handleProjectMetadata({
          ipfsHash,
          logManager,
          transaction,
          blockTimestamp,
          projectId: typedAccountId,
          originEventDetails: {
            logIndex,
            transactionHash,
            entity: accountMetadataEmittedEventModel,
          },
        });

        handled = true;
      }

      if (isNftDriverId(typedAccountId)) {
        const metadata = await getNftDriverMetadata(ipfsHash);

        if (this._isDripListMetadata(metadata)) {
          await handleDripListMetadata({
            ipfsHash,
            metadata,
            logManager,
            transaction,
            blockNumber,
            blockTimestamp,
            dripListId: typedAccountId,
            originEventDetails: {
              logIndex,
              transactionHash,
              entity: accountMetadataEmittedEventModel,
            },
          });

          handled = true;
        }

        if (this._isEcosystemMetadata(metadata)) {
          await handleEcosystemMetadata({
            ipfsHash,
            metadata,
            logManager,
            transaction,
            blockNumber,
            blockTimestamp,
            ecosystemId: typedAccountId,
            originEventDetails: {
              logIndex,
              transactionHash,
              entity: accountMetadataEmittedEventModel,
            },
          });

          handled = true;
        }
      }

      if (isImmutableSplitsDriverId(typedAccountId)) {
        await handleSubListMetadata({
          ipfsHash,
          logManager,
          transaction,
          blockTimestamp,
          subListId: typedAccountId,
          originEventDetails: {
            logIndex,
            transactionHash,
            entity: accountMetadataEmittedEventModel,
          },
        });

        handled = true;
      }

      if (!handled) {
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

  private _isDripListMetadata(
    metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
  ): boolean {
    return (
      metadata.isDripList ||
      ('type' in metadata ? metadata.type === 'dripList' : false)
    );
  }

  private _isEcosystemMetadata(
    metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
  ): boolean {
    return 'type' in metadata && metadata.type === 'ecosystem';
  }
}
