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
import { isLatestEvent } from '../utils/isLatestEvent';
import appSettings from '../config/appSettings';
import RecoverableError from '../utils/recoverableError';
import type { Address } from '../core/types';
import { nftDriverContract } from '../core/contractClients';

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

    const tokenId = convertToNftDriverId(rawTokenId);

    const onChainOwner = await nftDriverContract.ownerOf(tokenId);
    if (to !== onChainOwner) {
      scopedLogger.bufferMessage(
        `🚨🕵️‍♂️ Skipped Drip List or Ecosystem Main Account ${tokenId} TransferEvent processing: on-chain owner '${onChainOwner}' does not match event 'to' '${to}'.`,
      );

      return;
    }

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
        {
          transaction,
        },
      );

      scopedLogger.bufferCreation({
        type: TransferEventModel,
        input: transferEvent,
        id: `${transferEvent.transactionHash}-${transferEvent.logIndex}`,
      });

      // Only process if this is the latest event.
      if (
        !(await isLatestEvent(
          transferEvent,
          TransferEventModel,
          { tokenId },
          transaction,
        ))
      ) {
        scopedLogger.flush();

        return;
      }

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

      if (!dripList && !ecosystemMainAccount) {
        throw new RecoverableError(
          `Drip List or Ecosystem Main Account '${tokenId}' not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
        );
      }

      const entity = (dripList ?? ecosystemMainAccount)!;
      const entityModel = dripList ? DripListModel : EcosystemMainAccountModel;

      entity.ownerAddress = to as Address;
      entity.previousOwnerAddress = from as Address;
      entity.ownerAccountId = await calcAccountId(to as Address);
      entity.creator = to as Address; // TODO: https://github.com/drips-network/events-processor/issues/14

      const isAboveThreshold =
        blockNumber > appSettings.visibilityThresholdBlockNumber;
      const isMint = from === ZeroAddress;

      // Only re-compute vi visibility on real transfers. Mints are handled by metadata.
      if (!isMint) {
        entity.isVisible = !isAboveThreshold;
      }

      scopedLogger.bufferUpdate({
        input: entity,
        type: entityModel,
        id: entity.accountId,
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
    const { args, blockTimestamp, requestId } = context;
    const [from, to, tokenId] = args;

    await super.afterHandle({
      args: [
        tokenId,
        await calcAccountId(from as Address),
        await calcAccountId(to as Address),
      ],
      blockTimestamp,
      requestId,
    });
  }
}
