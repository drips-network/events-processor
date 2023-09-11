import type { NftDriverAccountId } from '../../../common/types';
import { getContractNameByAccountId } from '../../../utils/getContract';

export default function isNftDriverAccountId(
  id: string,
): id is NftDriverAccountId {
  const isNaN = Number.isNaN(Number(id));
  const isAccountIdOfNftDriver = getContractNameByAccountId(id) === 'nftDriver';

  if (isNaN || !isAccountIdOfNftDriver) {
    return false;
  }

  return true;
}
