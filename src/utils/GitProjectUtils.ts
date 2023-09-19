import type { AddressLike } from 'ethers';
import { ethers } from 'ethers';
import { FORGES_MAP } from '../common/constants';
import type { Forge } from '../common/types';
import type { GitProjectModel } from '../models';
import { ProjectVerificationStatus } from '../models/GitProjectModel';

export namespace GitProjectUtils {
  export function ownerAddressFromString(address: string): AddressLike {
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid owner address: ${address}.`);
    }

    return address as AddressLike;
  }

  export function forgeFromBigInt(forge: bigint): Forge {
    const forgeAsString = FORGES_MAP[Number(forge) as keyof typeof FORGES_MAP];

    if (!forgeAsString) {
      throw new Error(`Invalid forge value: ${forge}.`);
    }

    return forgeAsString;
  }

  export function nameFromBytes(bytes: string): string {
    return ethers.toUtf8String(bytes);
  }

  export function calculateStatus(
    project: GitProjectModel,
  ): ProjectVerificationStatus {
    if (
      project.ownerAddress === null &&
      !project.url &&
      !project.emoji &&
      !project.color &&
      !project.ownerName
    ) {
      return ProjectVerificationStatus.Unclaimed;
    }

    if (
      project.ownerAddress &&
      project.url &&
      project.emoji &&
      project.color &&
      project.ownerName
    ) {
      return ProjectVerificationStatus.Claimed;
    }

    if (
      project.ownerAddress &&
      !project.url &&
      !project.emoji &&
      !project.color &&
      !project.ownerName
    ) {
      return ProjectVerificationStatus.PendingMetadata;
    }

    if (
      project.ownerAddress === null &&
      project.url &&
      project.emoji &&
      project.color &&
      project.ownerName
    ) {
      return ProjectVerificationStatus.PendingOwner;
    }

    throw new Error(
      `Unexpected Git Project verification status for project ${JSON.stringify(
        project,
        null,
        2,
      )}.`,
    );
  }
}
