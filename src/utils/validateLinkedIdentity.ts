import type { Transaction } from 'sequelize';
import { dripsContract } from '../core/contractClients';
import type { SplitsReceiverStruct } from '../../contracts/CURRENT_NETWORK/Drips';
import type { AccountId, AddressDriverId } from '../core/types';
import logger from '../core/logger';
import { checkIncompleteDeadlineReceivers } from './checkIncompleteDeadlineReceivers';

export async function validateLinkedIdentity(
  accountId: AccountId,
  expectedOwnerAccountId: AddressDriverId,
  transaction: Transaction,
): Promise<boolean> {
  try {
    const onChainHash = await dripsContract.splitsHash(accountId);

    // Create the expected split receiver configuration (100% to owner)
    const expectedReceivers: SplitsReceiverStruct[] = [
      {
        accountId: expectedOwnerAccountId,
        weight: 1_000_000,
      },
    ];

    const expectedHash = await dripsContract.hashSplits(expectedReceivers);

    const isHashValid = onChainHash === expectedHash;

    const hasIncompleteDeadlines = await checkIncompleteDeadlineReceivers(
      accountId,
      transaction,
    );

    if (hasIncompleteDeadlines) {
      logger.warn(
        `LinkedIdentity ${accountId} has splits pointing to incomplete deadline accounts`,
      );
    }

    return isHashValid && !hasIncompleteDeadlines;
  } catch (error) {
    logger.error('Error validating linked identity', error);
    return false;
  }
}
