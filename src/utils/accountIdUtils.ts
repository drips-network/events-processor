import type { AddressLike } from 'ethers';
import type {
  AccountId,
  AddressDriverId,
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../core/types';
import { addressDriverContract } from '../core/contractClients';
import { getContractNameFromAccountId } from './contractUtils';

// RepoDriver
export function isRepoDriverId(id: string | bigint): id is RepoDriverId {
  const idStr = typeof id === 'bigint' ? id.toString() : id;
  const isNaN = Number.isNaN(Number(idStr));
  const isAccountIdOfRepoDriver =
    getContractNameFromAccountId(idStr) === 'repoDriver';

  if (isNaN || !isAccountIdOfRepoDriver) {
    return false;
  }

  return true;
}

export function convertToRepoDriverId(id: bigint | string): RepoDriverId {
  const repoDriverId = typeof id === 'bigint' ? id.toString() : id;

  if (!isRepoDriverId(repoDriverId)) {
    throw new Error(`Failed to convert: '${id}' is not a valid RepoDriver ID.`);
  }

  return repoDriverId as RepoDriverId;
}

// NftDriver
export function isNftDriverId(id: string | bigint): id is NftDriverId {
  const idStr = typeof id === 'bigint' ? id.toString() : id;
  const isNaN = Number.isNaN(Number(idStr));
  const isAccountIdOfNftDriver =
    getContractNameFromAccountId(idStr) === 'nftDriver';

  if (isNaN || !isAccountIdOfNftDriver) {
    return false;
  }

  return true;
}

export function convertToNftDriverId(id: bigint | string): NftDriverId {
  const nftDriverId = typeof id === 'bigint' ? id.toString() : id;

  if (!isNftDriverId(nftDriverId)) {
    throw new Error(`Failed to convert: '${id}' is not a valid NftDriver ID.`);
  }

  return nftDriverId as NftDriverId;
}

// AddressDriver
export function isAddressDriverId(
  idString: string,
): idString is AddressDriverId {
  const isNaN = Number.isNaN(Number(idString));

  const isAccountIdOfAddressDriver =
    getContractNameFromAccountId(idString) === 'addressDriver';

  if (isNaN || !isAccountIdOfAddressDriver) {
    return false;
  }

  return true;
}

export function convertToAddressDriverId(id: string): AddressDriverId {
  if (!isAddressDriverId(id)) {
    throw new Error(
      `Failed to convert: '${id}' is not a valid AddressDriver ID.`,
    );
  }

  return id as AddressDriverId;
}

export function assertAddressDiverId(
  id: string,
): asserts id is AddressDriverId {
  if (!isAddressDriverId(id)) {
    throw new Error(
      `Failed to assert: '${id}' is not a valid AddressDriver ID.`,
    );
  }
}

// ImmutableSplitsDriver
export function isImmutableSplitsDriverId(
  id: string | bigint,
): id is ImmutableSplitsDriverId {
  const idString = typeof id === 'bigint' ? id.toString() : id;
  const isNaN = Number.isNaN(Number(idString));
  const immutableSplitsDriverId =
    getContractNameFromAccountId(idString) === 'immutableSplitsDriver';

  if (isNaN || !immutableSplitsDriverId) {
    return false;
  }

  return true;
}

export function convertToImmutableSplitsDriverId(
  id: string | bigint,
): ImmutableSplitsDriverId {
  const stringId = typeof id === 'bigint' ? id.toString() : id;

  if (!isImmutableSplitsDriverId(stringId)) {
    throw new Error(
      `Failed to convert: '${id}' is not a valid ImmutableSplitsDriver ID.`,
    );
  }

  return stringId as ImmutableSplitsDriverId;
}

export async function calcAccountId(owner: AddressLike): Promise<AccountId> {
  return (
    await addressDriverContract.calcAccountId(owner as string)
  ).toString() as AccountId;
}

// Account ID
export function convertToAccountId(id: bigint | string): AccountId {
  const accountidString = typeof id === 'bigint' ? id.toString() : id;

  if (
    isRepoDriverId(accountidString) ||
    isNftDriverId(accountidString) ||
    isAddressDriverId(accountidString) ||
    isImmutableSplitsDriverId(accountidString)
  ) {
    return accountidString as AccountId;
  }

  throw new Error(`Failed to convert: '${id}' is not a valid account ID.`);
}

export function assertIsAccountId(
  id: string | bigint,
): asserts id is AccountId {
  const accountId = typeof id === 'bigint' ? id.toString() : id;

  if (
    !isRepoDriverId(accountId) &&
    !isNftDriverId(accountId) &&
    !isAddressDriverId(accountId) &&
    !isImmutableSplitsDriverId(accountId)
  ) {
    throw new Error(
      `Failed to assert: '${accountId}' is not a valid account ID.`,
    );
  }
}
