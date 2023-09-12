import type { AddressLike } from 'ethers';
import calcSaltFromAddress from './calcSaltFromAddress';
import { getNftDriver } from '../../utils/getContractClient';

export default async function IsDripList(
  accountId: string,
  totalOwnerNftAccounts: number,
  ownerAddress: AddressLike,
): Promise<boolean> {
  const salt = calcSaltFromAddress(
    ownerAddress.toString(),
    totalOwnerNftAccounts - 1, // TODO: document why this is -1.
  );

  const nftDriver = await getNftDriver();
  const expectedTokenId = await nftDriver.calcTokenIdWithSalt(
    ownerAddress,
    salt,
  );

  if (expectedTokenId.toString() !== accountId) {
    return false;
  }

  return true;
}
