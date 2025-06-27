import { ZeroAddress } from 'ethers';
import type { TransferEvent } from '../../contracts/CURRENT_NETWORK/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import ScopedLogger from '../core/ScopedLogger';
import { convertToNftDriverId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import {
  DripListModel,
  EcosystemMainAccountModel,
  TransferEventModel,
} from '../models';
import { dbConnection } from '../db/database';
import RecoverableError from '../utils/recoverableError';
import type { Address, AddressDriverId } from '../core/types';
import {
  addressDriverContract,
  nftDriverContract,
} from '../core/contractClients';
import unreachableError from '../utils/unreachableError';
import appSettings from '../config/appSettings';
import { makeVersion } from '../utils/lastProcessedVersion';

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

    const isMint = from === ZeroAddress;

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

    await dbConnection.transaction(async (transaction) => {
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

      const dripList = await DripListModel.findByPk(tokenId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const ecosystemMainAccount = await EcosystemMainAccountModel.findByPk(
        tokenId,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        },
      );

      const entity = dripList ?? ecosystemMainAccount;
      const Model = dripList ? DripListModel : EcosystemMainAccountModel;

      if (!entity) {
        scopedLogger.flush();

        throw new RecoverableError(
          `Cannot process '${eventSignature}' event for Drip List or Ecosystem Main Account ${tokenId}: entity not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
        );
      }

      if (dripList && ecosystemMainAccount) {
        unreachableError(
          `Invariant violation: both Drip List and Ecosystem Main Account found for token '${tokenId}'.`,
        );
      }

      const newVersion = makeVersion(blockNumber, logIndex);
      const storedVersion = BigInt(entity.lastProcessedVersion);

      if (isMint) {
        entity.creator = to as Address;

        scopedLogger.bufferUpdate({
          type: Model,
          id: entity.accountId,
          input: entity,
        });

        await entity.save({ transaction });
      }

      const onChainOwner = (await nftDriverContract.ownerOf(
        tokenId,
      )) as Address;

      if (to !== onChainOwner) {
        scopedLogger.bufferMessage(
          `Skipped Drip List or Ecosystem Main Account ${tokenId} '${eventSignature}' event processing: event is not the latest (on-chain owner '${onChainOwner}' does not match 'to' '${to}').`,
        );

        scopedLogger.flush();

        return;
      }

      // Update to the latest on-chain state.
      entity.ownerAddress = onChainOwner; // Equal to `to`.
      entity.ownerAccountId = (
        await addressDriverContract.calcAccountId(onChainOwner)
      ).toString() as AddressDriverId; // Equal to `to`.
      entity.previousOwnerAddress = from as Address;

      // Safely update fields that another event handler could also modify.
      if (newVersion > storedVersion) {
        entity.isVisible =
          blockNumber > appSettings.visibilityThresholdBlockNumber
            ? from === ZeroAddress // If it's a mint, then the Drip List will be visible. If it's a real transfer, then it's not.
            : true; // If the block number is less than the visibility threshold, then the Drip List is visible by default.
      }

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
        (
          await addressDriverContract.calcAccountId(from)
        ).toString() as AddressDriverId,
        (
          await addressDriverContract.calcAccountId(to)
        ).toString() as AddressDriverId,
      ],
      blockTimestamp: context.blockTimestamp,
      requestId: context.requestId,
    });
  }
}
