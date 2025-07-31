import { dripsContract } from '../core/contractClients';
import { formatSplitReceivers } from './formatSplitReceivers';
import type { SplitsReceiverStruct } from '../../contracts/CURRENT_NETWORK/Drips';
import type { AccountId, AddressDriverId } from '../core/types';
import logger from '../core/logger';

export async function validateLinkedIdentity(
  accountId: AccountId,
  expectedOwnerAccountId: AddressDriverId,
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

    const expectedHash = await dripsContract.hashSplits(
      formatSplitReceivers(expectedReceivers),
    );

    return onChainHash === expectedHash;
  } catch (error) {
    logger.error('Error validating linked identity', error);
    return false;
  }
}
