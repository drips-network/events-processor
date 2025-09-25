import type { Transaction } from 'sequelize';
import type { z } from 'zod';
import type ScopedLogger from '../core/ScopedLogger';
import type {
  AccountId,
  RepoDeadlineDriverId,
  RepoDriverId,
} from '../core/types';
import DeadlineModel from '../models/DeadlineModel';
import { repoDeadlineDriverContract } from '../core/contractClients';
import type { deadlineSplitReceiverSchema } from '../metadata/schemas/repo-driver/v6';
import { verifyProjectSource } from './projectUtils';
import {
  convertToAccountId,
  convertToRepoDeadlineDriverId,
  convertToRepoDriverId,
} from './accountIdUtils';
import { getAccountType } from './getAccountType';
import type { gitHubSourceSchema } from '../metadata/schemas/common/sources';

async function calcDeadlineAccountId(
  repoAccountId: RepoDriverId,
  recipientAccountId: AccountId,
  refundAccountId: AccountId,
  deadline: Date,
): Promise<RepoDeadlineDriverId> {
  const deadlineInSeconds = BigInt(Math.floor(deadline.getTime() / 1000));

  const calculatedAccountId = await repoDeadlineDriverContract.calcAccountId(
    repoAccountId,
    recipientAccountId,
    refundAccountId,
    deadlineInSeconds,
  );

  return convertToRepoDeadlineDriverId(calculatedAccountId);
}

type DeadlineReceiverVerificationResult = {
  isValid: boolean;
  message?: string;
};

export async function verifyDeadlineReceiver(
  receiver: NormalizedDeadlineReceiver,
): Promise<DeadlineReceiverVerificationResult> {
  const {
    accountId: deadlineAccountId,
    recipientAccountId,
    refundAccountId,
    deadline,
    claimableProject,
  } = receiver;

  const { accountId: repoAccountId, source } = claimableProject;

  const expectedAccountId = await calcDeadlineAccountId(
    repoAccountId,
    recipientAccountId,
    refundAccountId,
    deadline,
  );

  if (expectedAccountId !== deadlineAccountId) {
    return {
      isValid: false,
      message: `Metadata Deadline receiver ${deadlineAccountId} mismatches on-chain calculation ${expectedAccountId} for repo ${repoAccountId} (${source.url}), recipient ${recipientAccountId}, refund ${refundAccountId}, deadline ${deadline.toISOString()}.`,
    };
  }

  return verifyProjectSource(repoAccountId, source);
}

export async function ensureDeadlineExists(ctx: {
  deadline: NormalizedDeadlineReceiver;
  transaction: Transaction;
  scopedLogger: ScopedLogger;
}): Promise<void> {
  const {
    deadline: {
      accountId,
      claimableProject,
      recipientAccountId,
      refundAccountId,
      deadline,
    },
    transaction,
    scopedLogger,
  } = ctx;

  const receiverAccountType = await getAccountType(
    recipientAccountId,
    transaction,
  );
  const refundAccountType = await getAccountType(refundAccountId, transaction);

  const [deadlineEntry, isCreation] = await DeadlineModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: {
      accountId,
    },
    defaults: {
      accountId,
      receiverAccountId: recipientAccountId,
      receiverAccountType,
      claimableProjectId: claimableProject.accountId,
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
  }
}

type NormalizedDeadlineReceiver = {
  type: 'deadline';
  weight: number;
  accountId: RepoDeadlineDriverId;
  claimableProject: {
    accountId: RepoDriverId;
    source: z.infer<typeof gitHubSourceSchema>;
  };
  recipientAccountId: AccountId;
  refundAccountId: AccountId;
  deadline: Date;
};

export function normalizeDeadlineReceiver(
  receiver: z.infer<typeof deadlineSplitReceiverSchema>,
): NormalizedDeadlineReceiver {
  const { accountId, refundAccountId, claimableProject, recipientAccountId } =
    receiver;

  return {
    ...receiver,
    accountId: convertToRepoDeadlineDriverId(accountId),
    recipientAccountId: convertToAccountId(recipientAccountId),
    refundAccountId: convertToAccountId(refundAccountId),
    claimableProject: {
      accountId: convertToRepoDriverId(claimableProject.accountId),
      source: claimableProject.source,
    },
  };
}
