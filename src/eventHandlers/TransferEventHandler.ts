import { ZeroAddress } from 'ethers';
import type { TransferEvent } from '../../contracts/CURRENT_NETWORK/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import ScopedLogger from '../core/ScopedLogger';
import { calcAccountId, convertToNftDriverId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import {
  DripListModel,
  EcosystemMainAccountModel,
  TransferEventModel,
} from '../models';
import { dbConnection } from '../db/database';
import RecoverableError from '../utils/recoverableError';
import type { Address } from '../core/types';
import { nftDriverContract } from '../core/contractClients';
import { decodeVersion, makeVersion } from '../utils/lastProcessedVersion';
import unreachableError from '../utils/unreachableError';
import appSettings from '../config/appSettings';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignatures = ['Transfer(address,address,uint256)' as const];

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
  }: EventHandlerRequest<'Transfer(address,address,uint256)'>): Promise<void> {
    const [from, to, rawTokenId] = args as TransferEvent.OutputTuple;
    const tokenId = convertToNftDriverId(rawTokenId);
    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - from:       ${from}`,
        `  - to:         ${to}`,
        `  - tokenId:    ${rawTokenId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
    );

    const onChainOwner = (await nftDriverContract.ownerOf(tokenId)) as Address;
    if (to !== onChainOwner) {
      scopedLogger.log(
        `Skipped Drip List or Ecosystem Main Account ${tokenId} 'Transfer' event processing: on-chain owner '${onChainOwner}' does not match event 'to' '${to}'.`,
      );

      return;
    }

    await dbConnection.transaction(async (transaction) => {
      const dripList = await DripListModel.findByPk(tokenId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const ecosystemMain = await EcosystemMainAccountModel.findByPk(tokenId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const entity = dripList ?? ecosystemMain!;
      const Model = dripList ? DripListModel : EcosystemMainAccountModel;

      if (!entity) {
        throw new RecoverableError(
          `Drip List or Ecosystem Main Account '${tokenId}' not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
        );
      }
      if (dripList && ecosystemMain) {
        unreachableError(
          `Invariant violation: both Drip List and Ecosystem Main Account found for token '${tokenId}'.`,
        );
      }

      const newVersion = makeVersion(blockNumber, logIndex);
      const storedVersion = BigInt(entity.lastProcessedVersion);
      const { blockNumber: sb, logIndex: sl } = decodeVersion(storedVersion);
      const isMint = from === ZeroAddress;

      // Always set the `creator` from a mint event.
      if (isMint) {
        if (entity.creator) {
          unreachableError(
            `Invariant violation: mint for ${Model.name} ${tokenId} but 'creator' already set to '${entity.creator}'.`,
          );
        }

        const transferEvent = await TransferEventModel.create(
          {
            tokenId,
            to: to as Address,
            from: from as Address,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
          },
          { transaction },
        );

        scopedLogger.bufferCreation({
          input: transferEvent,
          type: TransferEventModel,
          id: `${transactionHash}-${logIndex}`,
        });

        entity.creator = onChainOwner; // Equal to `to`.
        entity.ownerAddress = onChainOwner; // Equal to `to`.
        entity.ownerAccountId = await calcAccountId(onChainOwner);
        entity.previousOwnerAddress = ZeroAddress as Address;

        scopedLogger.bufferUpdate({
          type: Model,
          id: entity.accountId,
          input: entity,
        });

        await entity.save({ transaction });

        scopedLogger.flush();

        return;
      }

      // Staleness guard: skip if not strictly newer.
      if (newVersion <= storedVersion) {
        scopedLogger.log(
          `Skipped Drip List or Ecosystem Main Account ${tokenId} stale 'Transfer' event (${blockNumber}:${logIndex} ≤ lastProcessed ${sb}:${sl}).`,
        );

        scopedLogger.flush();

        return;
      }

      const transferEvent = await TransferEventModel.create(
        {
          tokenId,
          to: to as Address,
          from: from as Address,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        { transaction },
      );

      scopedLogger.bufferCreation({
        type: TransferEventModel,
        id: `${transactionHash}-${logIndex}`,
        input: transferEvent,
      });

      // Normal update.
      const actualPrev = entity.ownerAddress ?? (from as Address);
      entity.previousOwnerAddress = actualPrev;

      entity.ownerAddress = onChainOwner; // Equal to `to`.
      entity.ownerAccountId = await calcAccountId(onChainOwner); // Equal to `to`.

      entity.isVisible = !(
        blockNumber > appSettings.visibilityThresholdBlockNumber
      );

      entity.lastProcessedVersion = newVersion.toString();

      scopedLogger.bufferUpdate({
        type: Model,
        id: entity.accountId,
        input: entity,
      });

      await entity.save({ transaction });

      scopedLogger.flush();
    });
  }

  override async afterHandle(context: {
    args: [from: string, to: string, tokenId: bigint];
    blockTimestamp: Date;
    requestId: string;
  }): Promise<void> {
    const [from, to, tokenId] = context.args;
    await super.afterHandle({
      args: [
        tokenId,
        await calcAccountId(from as Address),
        await calcAccountId(to as Address),
      ],
      blockTimestamp: context.blockTimestamp,
      requestId: context.requestId,
    });
  }
}
