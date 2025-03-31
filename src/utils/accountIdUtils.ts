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
export function isRepoDriverId(id: string): id is RepoDriverId {
  const isNaN = Number.isNaN(Number(id));
  const isAccountIdOfRepoDriver =
    getContractNameFromAccountId(id) === 'repoDriver';

  if (isNaN || !isAccountIdOfRepoDriver) {
    return false;
  }

  return true;
}

export function toRepoDriverId(id: bigint): RepoDriverId {
  const repoDriverId = id.toString();

  if (!isRepoDriverId(repoDriverId)) {
    throw new Error(`Invalid 'RepoDriver' account ID: ${id}.`);
  }

  return repoDriverId as RepoDriverId;
}

// NftDriver
export function isNftDriverId(id: string): id is NftDriverId {
  const isNaN = Number.isNaN(Number(id));
  const isAccountIdOfNftDriver =
    getContractNameFromAccountId(id) === 'nftDriver';

  if (isNaN || !isAccountIdOfNftDriver) {
    return false;
  }

  return true;
}

export function toNftDriverId(id: bigint | string): NftDriverId {
  const nftDriverId = typeof id === 'bigint' ? id.toString() : id;

  if (!isNftDriverId(nftDriverId)) {
    throw new Error(`Invalid 'NftDriver' account ID: ${id}.`);
  }

  return nftDriverId as NftDriverId;
}

// AddressDriver
export function isAddressDriverId(
  idAsString: string,
): idAsString is AddressDriverId {
  const isNaN = Number.isNaN(Number(idAsString));

  const isAccountIdOfAddressDriver =
    getContractNameFromAccountId(idAsString) === 'addressDriver';

  if (isNaN || !isAccountIdOfAddressDriver) {
    return false;
  }

  return true;
}

export function toAddressDriverId(id: string): AddressDriverId {
  if (!isAddressDriverId(id)) {
    throw new Error(`Invalid 'AddressDriver' account ID: ${id}.`);
  }

  return id as AddressDriverId;
}

export function assertAddressDiverId(
  id: string,
): asserts id is AddressDriverId {
  if (!isAddressDriverId(id)) {
    throw new Error(`String ${id} is not a valid 'AddressDriverId'.`);
  }
}

// ImmutableSplitsDriver
export function isImmutableSplitsDriverId(
  id: string,
): id is ImmutableSplitsDriverId {
  const isNaN = Number.isNaN(Number(id));
  const immutableSplitsDriverId =
    getContractNameFromAccountId(id) === 'immutableSplitsDriver';

  if (isNaN || !immutableSplitsDriverId) {
    return false;
  }

  return true;
}

export function toImmutableSplitsDriverId(
  id: string | bigint,
): ImmutableSplitsDriverId {
  const stringId = typeof id === 'bigint' ? id.toString() : id;

  if (!isImmutableSplitsDriverId(stringId)) {
    throw new Error(`Invalid 'ImmutableSplitsDriver' account ID: ${stringId}.`);
  }

  return stringId as ImmutableSplitsDriverId;
}

export async function calcAccountId(owner: AddressLike): Promise<AccountId> {
  return (
    await addressDriverContract.calcAccountId(owner as string)
  ).toString() as AccountId;
}

// Account ID
export function toAccountId(id: bigint): AccountId {
  const accountIdAsString = id.toString();

  if (
    isRepoDriverId(accountIdAsString) ||
    isNftDriverId(accountIdAsString) ||
    isAddressDriverId(accountIdAsString) ||
    isImmutableSplitsDriverId(accountIdAsString)
  ) {
    return accountIdAsString as AccountId;
  }

  throw new Error(`Invalid account ID: ${id}.`);
}
