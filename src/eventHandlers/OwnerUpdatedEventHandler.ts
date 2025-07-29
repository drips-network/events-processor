import type { Transaction } from 'sequelize';
import type { OwnerUpdatedEvent } from '../../contracts/CURRENT_NETWORK/RepoDriver';
import {
  addressDriverContract,
  repoDriverContract,
} from '../core/contractClients';
import ScopedLogger from '../core/ScopedLogger';
import type { Address, AddressDriverId, RepoDriverId } from '../core/types';
import { dbConnection } from '../db/database';
import EventHandlerBase from '../events/EventHandlerBase';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { ProjectModel, LinkedIdentityModel } from '../models';
import OwnerUpdatedEventModel from '../models/OwnerUpdatedEventModel';
import { convertToRepoDriverId, isOrcidAccount } from '../utils/accountIdUtils';
import { makeVersion } from '../utils/lastProcessedVersion';
import { calculateProjectStatus } from '../utils/projectUtils';
import {
  createSplitReceiver,
  deleteExistingSplitReceivers,
} from './AccountMetadataEmittedEvent/receiversRepository';

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
    const [rawAccountId, owner] = args as OwnerUpdatedEvent.OutputTuple;
    const accountId = convertToRepoDriverId(rawAccountId);

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - owner:      ${owner}`,
        `  - accountId:  ${accountId}`,
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
          accountId,
        },
        { transaction },
      );

      scopedLogger.bufferCreation({
        input: ownerUpdatedEvent,
        type: OwnerUpdatedEventModel,
        id: `${transactionHash}-${logIndex}`,
      });

      if (isOrcidAccount(accountId)) {
        await this._handleOrcidLinkedIdentity({
          logIndex,
          accountId,
          transaction,
          blockNumber,
          scopedLogger,
          blockTimestamp,
          owner: onChainOwner,
        });
      } else {
        // Handle regular project.
        const [project, isCreation] = await ProjectModel.findOrCreate({
          transaction,
          lock: transaction.LOCK.UPDATE,
          where: {
            accountId,
          },
          defaults: {
            accountId,
            ownerAddress: onChainOwner,
            ownerAccountId: (
              await addressDriverContract.calcAccountId(onChainOwner)
            ).toString() as AddressDriverId,
            claimedAt: blockTimestamp,
            verificationStatus: 'pending_metadata',
            isVisible: true, // Visible by default. Account metadata will set the final visibility.
            isValid: true, // There are no receivers yet. Consider the project valid.
            lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
          },
        });

        if (isCreation) {
          scopedLogger.bufferCreation({
            type: ProjectModel,
            input: project,
            id: project.accountId,
          });
        } else {
          const newVersion = makeVersion(blockNumber, logIndex);
          const storedVersion = BigInt(project.lastProcessedVersion);

          // Safely update fields that another event handler could also modify.
          if (newVersion > storedVersion) {
            project.verificationStatus = calculateProjectStatus(project);
          }

          project.ownerAccountId = (
            await addressDriverContract.calcAccountId(onChainOwner)
          ).toString() as AddressDriverId;
          project.ownerAddress = onChainOwner;
          project.claimedAt = blockTimestamp;

          project.lastProcessedVersion = newVersion.toString();

          scopedLogger.bufferUpdate({
            type: ProjectModel,
            id: project.accountId,
            input: project,
          });

          await project.save({ transaction });
        }
      }

      scopedLogger.flush();
    });
  }

  private async _handleOrcidLinkedIdentity({
    owner,
    logIndex,
    accountId,
    blockNumber,
    transaction,
    scopedLogger,
    blockTimestamp,
  }: {
    owner: Address;
    logIndex: number;
    blockNumber: number;
    blockTimestamp: Date;
    accountId: RepoDriverId;
    transaction: Transaction;
    scopedLogger: ScopedLogger;
  }): Promise<void> {
    const [linkedIdentity, isCreation] = await LinkedIdentityModel.findOrCreate(
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
        where: {
          accountId,
        },
        defaults: {
          accountId,
          identityType: 'orcid',
          ownerAddress: owner,
          ownerAccountId: (
            await addressDriverContract.calcAccountId(owner)
          ).toString() as AddressDriverId,
          lastProcessedVersion: makeVersion(blockNumber, logIndex).toString(),
        },
      },
    );

    if (isCreation) {
      scopedLogger.bufferCreation({
        type: LinkedIdentityModel,
        input: linkedIdentity,
        id: linkedIdentity.accountId,
      });
    } else {
      // Update existing linked identity
      linkedIdentity.ownerAddress = owner;
      linkedIdentity.ownerAccountId = (
        await addressDriverContract.calcAccountId(owner)
      ).toString() as AddressDriverId;
      linkedIdentity.lastProcessedVersion = makeVersion(
        blockNumber,
        logIndex,
      ).toString();

      scopedLogger.bufferUpdate({
        type: LinkedIdentityModel,
        id: linkedIdentity.accountId,
        input: linkedIdentity,
      });

      await linkedIdentity.save({ transaction });
    }

    await deleteExistingSplitReceivers(accountId, transaction);

    await createSplitReceiver({
      scopedLogger,
      transaction,
      splitReceiverShape: {
        senderAccountId: accountId,
        senderAccountType: 'linked_identity',
        receiverAccountId: linkedIdentity.ownerAccountId,
        receiverAccountType: 'address',
        relationshipType: 'identity_owner',
        weight: 1_000_000, // 100%
        blockTimestamp,
      },
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
