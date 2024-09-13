import { getDripsContract } from '../../../contracts/contract-types';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import loadChainConfig from '../../config/loadChainConfig';
import FailoverProvider from '../../core/FailoverProvider';
import type { DripListId, ProjectId } from '../../core/types';

export default async function validateSplitsReceivers(
  accountId: ProjectId | DripListId,
  splits: SplitsReceiverStruct[],
): Promise<
  [
    areSplitsValid: boolean,
    onChainSplitsHash: string,
    calculatedSplitsHash: string,
  ]
> {
  const dripsContract = getDripsContract(
    loadChainConfig().contracts.drips.address,
    FailoverProvider.getActiveProvider(),
  );

  const formattedSplits = formatSplitReceivers(splits);
  const calculatedSplitsHash = await dripsContract.hashSplits(formattedSplits);
  const onChainSplitsHash = await dripsContract.splitsHash(accountId);

  if (calculatedSplitsHash !== onChainSplitsHash) {
    return [false, onChainSplitsHash, calculatedSplitsHash];
  }

  return [true, onChainSplitsHash, calculatedSplitsHash];
}

export function formatSplitReceivers(
  receivers: SplitsReceiverStruct[],
): SplitsReceiverStruct[] {
  // Splits receivers must be sorted by user ID, deduplicated, and without weights <= 0.

  const uniqueReceivers = receivers.reduce(
    (unique: SplitsReceiverStruct[], o) => {
      if (
        !unique.some(
          (obj: SplitsReceiverStruct) =>
            obj.accountId === o.accountId && obj.weight === o.weight,
        )
      ) {
        unique.push(o);
      }
      return unique;
    },
    [],
  );

  const sortedReceivers = uniqueReceivers.sort((a, b) =>
    // Sort by user ID.
    // eslint-disable-next-line no-nested-ternary
    BigInt(a.accountId) > BigInt(b.accountId)
      ? 1
      : BigInt(a.accountId) < BigInt(b.accountId)
        ? -1
        : 0,
  );

  return sortedReceivers;
}
