import type {
  RepoDriverId,
  NftDriverId,
  ImmutableSplitsDriverId,
} from '../../core/types';
import { dripsContract } from '../../core/contractClients';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';

type AccountId = RepoDriverId | NftDriverId | ImmutableSplitsDriverId;

export default async function verifySplitsReceivers(
  accountId: AccountId,
  splits: SplitsReceiverStruct[],
): Promise<
  [
    areSplitsValid: boolean,
    onChainSplitsHash: string,
    calculatedSplitsHash: string,
  ]
> {
  const calculatedHash = await dripsContract.hashSplits(
    formatSplitReceivers(splits),
  );
  const onChainHash = await dripsContract.splitsHash(accountId);

  const isValid = calculatedHash === onChainHash;

  return [isValid, onChainHash, calculatedHash];
}
