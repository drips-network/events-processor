import type {
  AccountId,
  AddressDriverId,
  NftDriverId,
  RepoDriverId,
} from '../core/types';
import { addressDriverContract } from '../core/contractClients';
import { getContractNameFromAccountId } from './contractUtils';

export function toRepoDriverId(id: bigint): RepoDriverId {
  const repoDriverId = id.toString();

  if (!isRepoDriverId(repoDriverId)) {
    throw new Error(`Invalid 'RepoDriver' account ID: ${id}.`);
  }

  return repoDriverId as RepoDriverId;
}

export function toNftDriverId(id: bigint): NftDriverId {
  const nftDriverId = id.toString();

  if (!isNftDriverId(nftDriverId)) {
    throw new Error(`Invalid 'NftDriver' account ID: ${id}.`);
  }

  return nftDriverId as NftDriverId;
}

export function toAccountId(id: bigint): AccountId {
  const accountIdAsString = id.toString();

  if (
    isRepoDriverId(accountIdAsString) ||
    isNftDriverId(accountIdAsString) ||
    isAddressDriverId(accountIdAsString)
  ) {
    return accountIdAsString as AccountId;
  }

  throw new Error(`Invalid account ID: ${id}.`);
}

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

export function assertAddressDiverId(
  id: string,
): asserts id is AddressDriverId {
  if (!isAddressDriverId(id)) {
    throw new Error(`String ${id} is not a valid 'AddressDriverId'.`);
  }
}

export function isNftDriverId(id: string): id is NftDriverId {
  const isNaN = Number.isNaN(Number(id));
  const isAccountIdOfNftDriver =
    getContractNameFromAccountId(id) === 'nftDriver';

  if (isNaN || !isAccountIdOfNftDriver) {
    return false;
  }

  return true;
}

export function assertNftDriverAccountId(
  id: string,
): asserts id is NftDriverId {
  if (!isNftDriverId(id)) {
    throw new Error(`String ${id} is not a valid 'NftDriverId'.`);
  }
}

export function isRepoDriverId(id: string): id is RepoDriverId {
  const isNaN = Number.isNaN(Number(id));
  const isAccountIdOfRepoDriver =
    getContractNameFromAccountId(id) === 'repoDriver';

  if (isNaN || !isAccountIdOfRepoDriver) {
    return false;
  }

  return true;
}

export function assertRepoDiverAccountId(
  id: string,
): asserts id is RepoDriverId {
  if (!isRepoDriverId(id)) {
    throw new Error(`String ${id} is not a valid 'RepoDriverId'.`);
  }
}

export async function getOwnerAccountId(
  owner: string,
): Promise<
  AccountId | PromiseLike<AccountId | null | undefined> | null | undefined
> {
  return (
    await addressDriverContract.calcAccountId(owner as string)
  ).toString() as AccountId;
}
