import type {
  RepoDriverId,
  NftDriverId,
  ImmutableSplitsDriverId,
} from '../../core/types';
import { dripsContract } from '../../core/contractClients';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';

export default async function verifySplitsReceivers(
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
