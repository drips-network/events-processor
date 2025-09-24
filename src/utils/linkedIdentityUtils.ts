import type { Transaction } from 'sequelize';
import type ScopedLogger from '../core/ScopedLogger';
import LinkedIdentityModel from '../models/LinkedIdentityModel';
import type { RepoDriverId } from '../core/types';
import { isOrcidAccount } from './accountIdUtils';
import { makeVersion } from './lastProcessedVersion';

export async function ensureLinkedIdentityExists(
  accountId: RepoDriverId,
  ctx: { blockNumber: number; logIndex: number },
  transaction: Transaction,
  scopedLogger: ScopedLogger,
): Promise<void> {
  if (!isOrcidAccount(accountId)) {
    throw new Error(
      `${ensureLinkedIdentityExists.name} called with non-ORCID accountId: ${accountId}`,
    );
  }

  const [identity, isCreation] = await LinkedIdentityModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { accountId },
    // Creates an "unclaimed" linked identity.
    defaults: {
      accountId,
      identityType: 'orcid',
      ownerAddress: null,
      ownerAccountId: null,
      areSplitsValid: false,
      lastProcessedVersion: makeVersion(
        ctx.blockNumber,
        ctx.logIndex,
      ).toString(),
    },
  });

  if (isCreation) {
    scopedLogger.bufferCreation({
      type: LinkedIdentityModel,
      input: identity,
      id: identity.accountId,
    });
  }
}
