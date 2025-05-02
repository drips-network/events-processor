import type { AnyVersion } from '@efstajas/versioned-parser';
import { toUtf8String } from 'ethers';
import type { AccountId } from '../../core/types';
import EventHandlerBase from '../../events/EventHandlerBase';
import { DRIPS_APP_USER_METADATA_KEY } from '../../core/constants';
import handleProjectMetadata from './handlers/handleProjectMetadata';
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
import { dbConnection } from '../../db/database';
import handleEcosystemMainAccountMetadata from './handlers/handleEcosystemMainAccountMetadata';
import handleSubListMetadata from './handlers/handleSubListMetadata';
import type { nftDriverAccountMetadataParser } from '../../metadata/schemas';
import { getCurrentSplitReceiversBySender } from './receiversRepository';
import type { AccountMetadataEmittedEvent } from '../../../contracts/CURRENT_NETWORK/Drips';
import { AccountMetadataEmittedEventModel } from '../../models';
import ScopedLogger from '../../core/ScopedLogger';

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

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - key:        ${toUtf8String(key)} (raw: ${key})`,
        `  - value:      ${ipfsHash} (raw: ${value})`,
        `  - accountId:  ${accountId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
    );

    if (!this._isEmittedByTheDripsApp(key)) {
      scopedLogger.log(
        `Skipping ${eventSignature} event: key '${key}' not emitted by the Drips App.`,
      );

      return;
    }

    if (!this._canProcessDriverType(accountId)) {
      scopedLogger.log(
        `Skipping ${eventSignature} event: accountId '${accountId}' is not of a Driver that can be processed.`,
      );

      return;
    }

    await dbConnection.transaction(async (transaction) => {
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

      scopedLogger.bufferCreation({
        type: AccountMetadataEmittedEventModel,
        input: accountMetadataEmittedEvent,
        id: `${accountMetadataEmittedEvent.transactionHash}-${accountMetadataEmittedEvent.logIndex}`,
      });

      if (isRepoDriverId(accountId)) {
        await handleProjectMetadata({
          logIndex,
          ipfsHash,
          blockNumber,
          scopedLogger,
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
            logIndex,
            metadata,
            scopedLogger,
            transaction,
            blockNumber,
            blockTimestamp,
            emitterAccountId: convertToNftDriverId(accountId),
          });
        } else if (this._isEcosystemMainAccountMetadata(metadata)) {
          await handleEcosystemMainAccountMetadata({
            ipfsHash,
            logIndex,
            metadata,
            scopedLogger,
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
          scopedLogger,
          transaction,
          blockTimestamp,
          emitterAccountId: convertToImmutableSplitsDriverId(accountId),
        });
      }

      scopedLogger.flush();
    });
  }

  public override async beforeHandle({
    event: { args },
    id: requestId,
  }: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(`${this.name} is gathering accountIds to invalidate...`);

    const [accountId] = args as AccountMetadataEmittedEvent.OutputTuple;

    const accountIdsToInvalidate = await getCurrentSplitReceiversBySender(
      convertToAccountId(accountId),
    );

    scopedLogger.log(
      `${this.name} account IDs to invalidate: ${
        accountIdsToInvalidate.length > 0
          ? accountIdsToInvalidate.join(', ')
          : 'none'
      }`,
    );

    return {
      accountIdsToInvalidate,
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
