/* eslint-disable no-bitwise */
import { ethers, type AddressLike } from 'ethers';
import type {
  AccountId,
  AddressDriverId,
  DripsContract,
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../core/types';
import { addressDriverContract } from '../core/contractClients';

export function getContractNameFromAccountId(id: string): DripsContract {
  if (Number.isNaN(Number(id))) {
    throw new Error(`Could not get bits: ${id} is not a number.`);
  }

  const accountIdAsBigInt = BigInt(id);

  if (accountIdAsBigInt < 0n || accountIdAsBigInt > 2n ** 256n - 1n) {
    throw new Error(
      `Could not get bits: ${id} is not a valid positive number within the range of a uint256.`,
    );
  }

  const mask = 2n ** 32n - 1n; // 32 bits mask

  const bits = (accountIdAsBigInt >> 224n) & mask; // eslint-disable-line no-bitwise

  switch (bits) {
    case 0n:
      return 'addressDriver';
    case 1n:
      return 'nftDriver';
    case 2n:
      return 'immutableSplitsDriver';
    case 3n:
      return 'repoDriver';
    default:
      throw new Error(`Unknown driver for ID ${id}.`);
  }
}

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

export function assertIsRepoDriverId(id: string): asserts id is RepoDriverId {
  if (!isRepoDriverId(id)) {
    throw new Error(`Failed to assert: '${id}' is not a valid RepoDriver ID.`);
  }
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

export function assertIsNftDriverId(id: string): asserts id is NftDriverId {
  if (!isNftDriverId(id)) {
    throw new Error(`Failed to assert: '${id}' is not a valid NftDriver ID.`);
  }
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

export function assertIsAddressDiverId(
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

export function assertIsImmutableSplitsDriverId(
  id: string,
): asserts id is ImmutableSplitsDriverId {
  if (!isImmutableSplitsDriverId(id)) {
    throw new Error(
      `Failed to assert: '${id}' is not a valid ImmutableSplitsDriver ID.`,
    );
  }
}

export async function calcAccountId(owner: AddressLike): Promise<AccountId> {
  return (
    await addressDriverContract.calcAccountId(owner as string)
  ).toString() as AccountId;
}

// Account ID
export function convertToAccountId(id: bigint | string): AccountId {
  const accountIdAsString = typeof id === 'bigint' ? id.toString() : id;

  if (
    isRepoDriverId(accountIdAsString) ||
    isNftDriverId(accountIdAsString) ||
    isAddressDriverId(accountIdAsString) ||
    isImmutableSplitsDriverId(accountIdAsString)
  ) {
    return accountIdAsString as AccountId;
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

export function getAddress(accountId: string): AddressLike {
  let accountIdBigInt: bigint;

  try {
    accountIdBigInt = BigInt(accountId);
  } catch {
    throw new Error(
      `Failed to get address: '${accountId}' is not a valid bigint string.`,
    );
  }

  if (accountIdBigInt < 0n || accountIdBigInt > 2n ** 256n - 1n) {
    throw new Error(
      `Failed to get address: '${accountId}' is not a valid positive number within the range of a uint256.`,
    );
  }

  if (getContractNameFromAccountId(accountId) !== 'addressDriver') {
    // Mid 64 bits after first 32 (128-191) must be zero
    const mid64Mask = ((1n << 64n) - 1n) << 160n;

    if ((accountIdBigInt & mid64Mask) !== 0n) {
      throw new Error(
        `Failed to get address: '${accountId}' is not a valid AddressDriver ID. The first 64 (after first 32) bits must be 0.`,
      );
    }
  }

  const addressMask = (1n << 160n) - 1n;
  const addressBigInt = accountIdBigInt & addressMask;

  // Convert to hex, pad to 20 bytes (40 hex chars), and checksum it
  const hex = `0x${addressBigInt.toString(16).padStart(40, '0')}`;
  return ethers.getAddress(hex);
}
