import { dripsContract } from '../../core/contractClients';
import { formatSplitReceivers } from '../../utils/formatSplitReceivers';
import type { SplitsReceiverStruct } from '../../../contracts/CURRENT_NETWORK/Drips';
import type { AccountId } from '../../core/types';

type SplitsHashVerificationResult = {
  isMatch: boolean;
  onChainHash: string;
  actualHash: string;
};

export default async function verifySplitsReceivers(
  accountId: AccountId,
  splitReceivers: SplitsReceiverStruct[],
): Promise<SplitsHashVerificationResult> {
  const actualHash = await dripsContract.hashSplits(
    formatSplitReceivers(splitReceivers),
  );

  const onChainHash = await dripsContract.splitsHash(accountId);

  return {
    isMatch: actualHash === onChainHash,
    onChainHash,
    actualHash,
  };
}
