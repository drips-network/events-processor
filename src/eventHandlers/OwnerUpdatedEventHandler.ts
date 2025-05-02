import type { OwnerUpdatedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import {
  addressDriverContract,
  repoDriverContract,
} from '../core/contractClients';
import ScopedLogger from '../core/ScopedLogger';
import type { Address, AddressDriverId } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { ProjectModel } from '../models';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import { convertToRepoDriverId } from '../utils/accountIdUtils';
import { makeVersion, decodeVersion } from '../utils/lastProcessedVersion';
import RecoverableError from '../utils/recoverableError';

export default class OwnerUpdatedEventHandler extends EventHandlerBase<'OwnerUpdated(uint256,address)'> {
  public readonly eventSignatures = ['OwnerUpdated(uint256,address)' as const];

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
  }: EventHandlerRequest<'OwnerUpdated(uint256,address)'>): Promise<void> {
    const [accountId, owner] = args as OwnerUpdatedEvent.OutputTuple;

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - owner:       ${owner}`,
        `  - accountId:   ${accountId}`,
        `  - logIndex:   ${logIndex}`,
        `  - txHash:     ${transactionHash}`,
      ].join('\n'),
    );

    const onChainOwner = (await repoDriverContract.ownerOf(
      accountId,
    )) as Address;
    if (owner !== onChainOwner) {
      scopedLogger.log(
        `Skipped Project ${accountId} 'OwnerUpdated' event processing: on-chain owner '${onChainOwner}' does not match event 'owner' '${owner}'.`,
      );

      return;
    }

    await dbConnection.transaction(async (transaction) => {
      const ownerUpdatedEvent = await OwnerUpdatedEventModel.create(
        {
          owner,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: convertToRepoDriverId(accountId),
        },
        { transaction },
      );

      scopedLogger.bufferCreation({
        input: ownerUpdatedEvent,
        type: OwnerUpdatedEventModel,
        id: `${transactionHash}-${logIndex}`,
      });

      const project = await ProjectModel.findByPk(accountId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!project) {
        throw new RecoverableError(
          `Cannot process 'OwnerUpdated' event for Project ${accountId}: project not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
        );
      }

      const newVersion = makeVersion(blockNumber, logIndex);
      const storedVersion = BigInt(project.lastProcessedVersion);
      const { blockNumber: sb, logIndex: sl } = decodeVersion(storedVersion);

      // Staleness guard: skip if not strictly newer.
      if (newVersion <= storedVersion) {
        scopedLogger.log(
          `Skipped Project ${accountId} stale 'OwnerUpdated' event (${blockNumber}:${logIndex} ≤ lastProcessed ${sb}:${sl}).`,
        );

        scopedLogger.flush();

        return;
      }

      project.ownerAddress = owner;
      project.claimedAt = blockTimestamp;
      project.ownerAccountId =
        ((
          await addressDriverContract.calcAccountId(onChainOwner)
        ).toString() as AddressDriverId) ?? null;
      project.verificationStatus = 'claimed';

      project.lastProcessedVersion = newVersion.toString();

      scopedLogger.bufferUpdate({
        type: ProjectModel,
        id: project.accountId,
        input: project,
      });

      await project.save({ transaction });

      scopedLogger.flush();
    });
  }

  override async afterHandle(context: {
    args: [accountId: bigint, owner: string];
    blockTimestamp: Date;
    requestId: string;
  }): Promise<void> {
    const { args, blockTimestamp } = context;
    const [accountId, owner] = args;

    const ownerAccountId = await addressDriverContract.calcAccountId(owner);

    super.afterHandle({
      args: [accountId, ownerAccountId],
      blockTimestamp,
      requestId: context.requestId,
    });
  }
}
