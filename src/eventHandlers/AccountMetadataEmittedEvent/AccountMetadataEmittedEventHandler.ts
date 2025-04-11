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
  convertToAccountId,
  convertToRepoDriverId,
  convertToNftDriverId,
  convertToImmutableSplitsDriverId,
} from '../../utils/accountIdUtils';
import {
  getNftDriverMetadata,
  convertToIpfsHash,
} from '../../utils/metadataUtils';
import handleDripListMetadata from './handlers/handleDripListMetadata';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import { AccountMetadataEmittedEventModel } from '../../models';
import { dbConnection } from '../../db/database';
import handleEcosystemMainAccountMetadata from './handlers/handleEcosystemMainAccountMetadata';
import handleSubListMetadata from './handlers/handleSubListMetadata';
import type { nftDriverAccountMetadataParser } from '../../metadata/schemas';
import { getCurrentSplitsByAccountId } from './receiversRepository';
import { isLatestEvent } from '../../utils/isLatestEvent';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignatures = [
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const,
  ];

  protected async _handle({
    id: requestId,
    event: {
      args,
      logIndex,
      blockNumber,
      blockTimestamp,
      transactionHash,
      eventSignature,
    },
  }: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>): Promise<void> {
    const [accountId, key, value] =
      args as AccountMetadataEmittedEvent.OutputTuple;

    const ipfsHash = convertToIpfsHash(value);

    LogManager.logRequestInfo(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - key:        ${key}`,
        `  - value:      ${value} (IPFS hash: ${ipfsHash})`,
        `  - accountId:  ${accountId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
      requestId,
    );

    if (!this._isEmittedByTheDripsApp(key)) {
      LogManager.logRequestInfo(
        `Skipping ${eventSignature} event: key '${key}' not emitted by the Drips App.`,
        requestId,
      );

      return;
    }

    if (!this._canProcessDriverType(accountId)) {
      LogManager.logRequestInfo(
        `Skipping ${eventSignature} event: accountId '${accountId}' is not a Driver type that can be processed.`,
        requestId,
      );

      return;
    }

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const accountMetadataEmittedEvent =
        await AccountMetadataEmittedEventModel.create(
          {
            key,
            value,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            accountId: convertToAccountId(accountId),
          },
          {
            transaction,
          },
        );

      logManager.appendFindOrCreateLog(
        AccountMetadataEmittedEventModel,
        true,
        `${accountMetadataEmittedEvent.transactionHash}-${accountMetadataEmittedEvent.logIndex}`,
      );

      // Only process metadata if this is the latest event.
      if (
        !(await isLatestEvent(
          accountMetadataEmittedEvent,
          AccountMetadataEmittedEventModel,
          {
            accountId: convertToAccountId(accountId),
          },
          transaction,
        ))
      ) {
        return;
      }

      if (isRepoDriverId(accountId)) {
        await handleProjectMetadata({
          ipfsHash,
          logManager,
          transaction,
          blockTimestamp,
          emitterAccountId: convertToRepoDriverId(accountId),
        });
      }

      if (isNftDriverId(accountId)) {
        const metadata = await getNftDriverMetadata(ipfsHash);

        if (this._isDripListMetadata(metadata)) {
          await handleDripListMetadata({
            ipfsHash,
            metadata,
            logManager,
            transaction,
            blockNumber,
            blockTimestamp,
            emitterAccountId: convertToNftDriverId(accountId),
          });
        }

        if (this._isEcosystemMainAccountMetadata(metadata)) {
          await handleEcosystemMainAccountMetadata({
            ipfsHash,
            metadata,
            logManager,
            transaction,
            blockNumber,
            blockTimestamp,
            emitterAccountId: convertToNftDriverId(accountId),
          });
        }
      }

      if (isImmutableSplitsDriverId(accountId)) {
        await handleSubListMetadata({
          ipfsHash,
          logManager,
          transaction,
          blockTimestamp,
          emitterAccountId: convertToImmutableSplitsDriverId(accountId),
        });
      }

      logManager.logAllInfo(this.name);
    });
  }

  public override async beforeHandle({
    event: { args },
  }: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    const [accountId] = args as AccountMetadataEmittedEvent.OutputTuple;

    return {
      accountIdsToInvalidate: await getCurrentSplitsByAccountId(accountId),
    };
  }

  private _isEmittedByTheDripsApp(key: string): boolean {
    return key === DRIPS_APP_USER_METADATA_KEY;
  }

  private _canProcessDriverType(accountId: bigint): boolean {
    return (
      isRepoDriverId(accountId) ||
      isNftDriverId(accountId) ||
      isImmutableSplitsDriverId(accountId)
    );
  }

  private _isEcosystemMainAccountMetadata(
    metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
  ): boolean {
    return 'type' in metadata && metadata.type === 'ecosystem';
  }

  private _isDripListMetadata(
    metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
  ): boolean {
    return (
      metadata.isDripList ||
      ('type' in metadata ? metadata.type === 'dripList' : false)
    );
  }
}
