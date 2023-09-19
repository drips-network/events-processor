import type {
  AccountId,
  NftDriverAccountId,
  RepoDriverAccountId,
} from '../common/types';
import {
  isAddressDriverAccountId,
  isNftDriverAccountId,
  isRepoDiverAccountId,
} from './assert';

export namespace AccountIdUtils {
  export function repoDriverAccountIdFromBigInt(
    accountId: bigint,
  ): RepoDriverAccountId {
    const repoDriverAccountId = accountId.toString();

    if (!isRepoDiverAccountId(repoDriverAccountId)) {
      throw new Error(`Invalid 'RepoDriver' account ID: ${accountId}.`);
    }

    return repoDriverAccountId as RepoDriverAccountId;
  }

  export function nftDriverAccountIdFromBigInt(
    accountId: bigint,
  ): NftDriverAccountId {
    const nftDriverAccountId = accountId.toString();

    if (!isNftDriverAccountId(nftDriverAccountId)) {
      throw new Error(`Invalid 'NftDriver' account ID: ${accountId}.`);
    }

    return nftDriverAccountId as NftDriverAccountId;
  }

  export function accountIdFromBigInt(accountId: bigint): AccountId {
    const accountIdAsString = accountId.toString();

    if (
      isRepoDiverAccountId(accountIdAsString) ||
      isNftDriverAccountId(accountIdAsString) ||
      isAddressDriverAccountId(accountIdAsString)
    ) {
      return accountIdAsString as RepoDriverAccountId;
    }

    throw new Error(`Invalid account ID: ${accountId}.`);
  }
}
