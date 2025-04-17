import { ZeroAddress } from 'ethers';
import type { TransferEvent } from '../../contracts/CURRENT_NETWORK/NftDriver';
import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
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

    LogManager.logRequestInfo(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - from:       ${from}`,
        `  - to:         ${to}`,
        `  - tokenId:    ${rawTokenId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const tokenId = convertToNftDriverId(rawTokenId);

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

      logManager.appendCreateLog(
        TransferEventModel,
        `${transferEvent.transactionHash}-${transferEvent.logIndex}`,
      );

      // Only process if this is the latest event.
      if (
        !(await isLatestEvent(
          transferEvent,
          TransferEventModel,
          { tokenId },
          transaction,
        ))
      ) {
        logManager.logAllInfo(this.name);

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
      entity.ownerAccountId = await calcAccountId(to);
      entity.creator = to as Address; // TODO: https://github.com/drips-network/events-processor/issues/14
      entity.isVisible =
        blockNumber > appSettings.visibilityThresholdBlockNumber
          ? from === ZeroAddress || from === appSettings.ecosystemDeployer
          : true;
      entity.isValid = true; // The entity is initialized with `false` when created during account metadata processing.

      logManager.appendUpdateLog(entity, entityModel, entity.accountId);

      await entity.save({ transaction });

      logManager.logAllInfo(this.name);
    });
  }

  override async afterHandle(context: {
    args: [from: string, to: string, tokenId: bigint];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [from, to, tokenId] = args;

    await super.afterHandle({
      args: [tokenId, await calcAccountId(from), await calcAccountId(to)],
      blockTimestamp,
    });
  }
}
