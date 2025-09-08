import type { AccountSeenEvent } from '../../../contracts/CURRENT_NETWORK/RepoDeadlineDriver';
import ScopedLogger from '../../core/ScopedLogger';
import { dbConnection } from '../../db/database';
import EventHandlerBase from '../../events/EventHandlerBase';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import DeadlineModel from '../../models/DeadlineModel';
import AccountSeenEventModel from '../../models/AccountSeenEventModel';
import {
  convertToAccountId,
  convertToRepoDeadlineDriverId,
  convertToRepoDriverId,
} from '../../utils/accountIdUtils';
import { getAccountType } from '../../utils/getAccountType';
import { isLatestEvent } from '../../utils/isLatestEvent';
import { findAffectedAccounts } from './findAffectedAccounts';
import { recalculateValidationFlags } from './recalculateValidationFlags';

export default class AccountSeenEventHandler extends EventHandlerBase<'AccountSeen(uint256,uint256,uint256,uint256,uint32)'> {
  public eventSignatures = [
    'AccountSeen(uint256,uint256,uint256,uint256,uint32)' as const,
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
  }: EventHandlerRequest<'AccountSeen(uint256,uint256,uint256,uint256,uint32)'>): Promise<void> {
    const [
      rawAccountId,
      rawRepoAccountId,
      rawRecipientAccountId,
      rawRefundAccountId,
      rawDeadline,
    ] = args as AccountSeenEvent.OutputTuple;

    const accountId = convertToRepoDeadlineDriverId(rawAccountId);
    const repoAccountId = convertToRepoDriverId(rawRepoAccountId);
    const receiverAccountId = convertToAccountId(rawRecipientAccountId);
    const refundAccountId = convertToAccountId(rawRefundAccountId);

    const deadline = new Date(Number(rawDeadline) * 1000);

    const scopedLogger = new ScopedLogger(this.name, requestId);

    await dbConnection.transaction(async (transaction) => {
      const receiverAccountType = await getAccountType(
        receiverAccountId,
        transaction,
      );
      const refundAccountType = await getAccountType(
        refundAccountId,
        transaction,
      );

      scopedLogger.log(
        [
          `📥 ${this.name} is processing ${eventSignature}:`,
          `  - accountId:          ${accountId}`,
          `  - repoAccountId:      ${repoAccountId}`,
          `  - receiverAccountId:  ${receiverAccountId} (${receiverAccountType})`,
          `  - refundAccountId:    ${refundAccountId} (${refundAccountType})`,
          `  - deadline:           ${deadline.toISOString()}`,
          `  - logIndex:           ${logIndex}`,
          `  - txHash:             ${transactionHash}`,
        ].join('\n'),
      );

      const accountSeenEvent = await AccountSeenEventModel.create(
        {
          accountId,
          repoAccountId,
          receiverAccountId,
          refundAccountId,
          deadline,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        { transaction },
      );

      scopedLogger.bufferCreation({
        type: AccountSeenEventModel,
        input: accountSeenEvent,
        id: `${transactionHash}-${logIndex}`,
      });

      if (
        !(await isLatestEvent(
          accountSeenEvent,
          AccountSeenEventModel,
          { accountId },
          transaction,
        ))
      ) {
        scopedLogger.flush();
        return;
      }

      const [deadlineEntry, isCreation] = await DeadlineModel.findOrCreate({
        transaction,
        lock: transaction.LOCK.UPDATE,
        where: {
          accountId,
        },
        defaults: {
          accountId,
          receiverAccountId,
          receiverAccountType,
          claimableProjectId: repoAccountId,
          deadline,
          refundAccountId,
          refundAccountType,
        },
      });

      if (isCreation) {
        scopedLogger.bufferCreation({
          type: DeadlineModel,
          input: deadlineEntry,
          id: accountId,
        });
      } else {
        // Update existing deadline
        deadlineEntry.receiverAccountId = receiverAccountId;
        deadlineEntry.receiverAccountType = receiverAccountType;
        deadlineEntry.claimableProjectId = repoAccountId;
        deadlineEntry.deadline = deadline;
        deadlineEntry.refundAccountId = refundAccountId;
        deadlineEntry.refundAccountType = refundAccountType;

        scopedLogger.bufferUpdate({
          type: DeadlineModel,
          id: accountId,
          input: deadlineEntry,
        });

        await deadlineEntry.save({ transaction });
      }

      // Recalculate validation flags for accounts affected by this deadline becoming "seen"
      const affectedAccounts = await findAffectedAccounts(
        accountId,
        transaction,
      );

      if (affectedAccounts.length > 0) {
        scopedLogger.bufferMessage(
          `Found ${affectedAccounts.length} accounts with splits pointing to deadline ${accountId}. Recalculating validation flags.`,
        );

        await recalculateValidationFlags(
          affectedAccounts,
          scopedLogger,
          transaction,
        );
      }

      scopedLogger.flush();
    });
  }
}
