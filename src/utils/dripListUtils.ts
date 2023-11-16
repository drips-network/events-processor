import type { AddressLike } from 'ethers';
import type { Transaction } from 'sequelize';
import calcSaltFromAddress from './calcSaltFromAddress';
import type { NftDriverId } from '../core/types';
import TransferEventModel from '../models/TransferEventModel';
import { nftDriverContract } from '../core/contractClients';

// The logic coupled to how the App creates new Drip Lists.
export default async function IsDripList(
  possibleDripListId: NftDriverId,
  transaction: Transaction,
): Promise<boolean> {
  const ownerAddress = await getOwnerAddressByAccountId(
    possibleDripListId,
    transaction,
  );

  const totalAccounts = await getAccountsCountByOwner(
    ownerAddress,
    transaction,
  );

  // We do not expect to have many Drip Lists per owner, so it's ok to iterate.
  for (const index of [
    0,
    ...Array(totalAccounts)
      .fill(1)
      .map((n, i) => n + i),
  ]) {
    const salt = calcSaltFromAddress(ownerAddress.toString(), index);

    const expectedTokenId = await nftDriverContract.calcTokenIdWithSalt(
      ownerAddress,
      salt,
    );

    if (expectedTokenId.toString() === possibleDripListId) {
      return true;
    }
  }

  return false;
}

async function getAccountsCountByOwner(
  ownerAddress: AddressLike,
  transaction: Transaction,
) {
  const total = await TransferEventModel.count({
    transaction,
    where: {
      to: ownerAddress,
    },
  });

  if (total === 0) {
    if (!total) {
      throw new Error(
        `No 'TransferEvent' was found for owner ${ownerAddress} but at least one expected to exist. The event that should have created the entry may not have been processed yet.`,
      );
    }
  }

  return total;
}

async function getOwnerAddressByAccountId(
  accountId: NftDriverId,
  transaction: Transaction,
): Promise<AddressLike> {
  const transferEvent = await TransferEventModel.findOne({
    lock: true,
    transaction,
    where: { tokenId: accountId },
  });

  if (!transferEvent) {
    throw new Error(
      `No 'TransferEvent' was found for the account ID ${accountId} but at least one expected to exist. The event that should have created the entry may not have been processed yet.`,
    );
  }

  return transferEvent.to;
}
