import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import type {
  RepoDriverId,
  NftDriverId,
  ImmutableSplitsDriverId,
} from '../../core/types';
import { dripsContract } from '../../core/contractClients';

export default async function validateSplitsReceivers(
  accountId: RepoDriverId | NftDriverId | ImmutableSplitsDriverId,
  splits: SplitsReceiverStruct[],
): Promise<
  [
    areSplitsValid: boolean,
    onChainSplitsHash: string,
    calculatedSplitsHash: string,
  ]
> {
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
