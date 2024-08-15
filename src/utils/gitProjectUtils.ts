import type { AddressLike } from 'ethers';
import { ethers } from 'ethers';
import { FORGES_MAP } from '../core/constants';
import type { Forge } from '../core/types';
import type { GitProjectModel } from '../models';
import { ProjectVerificationStatus } from '../models/GitProjectModel';
import unreachableError from './unreachableError';

export function toProjectOwnerAddress(address: string): AddressLike {
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid owner address: ${address}.`);
  }

  return address as AddressLike;
}

export function toUrl(forge: Forge, projectName: string): string {
  switch (forge) {
    case 'GitHub':
      return `https://github.com/${projectName}`;
    default:
      throw new Error(`Unsupported forge: ${forge}.`);
  }
}

export function toForge(forge: bigint): Forge {
  const forgeAsString = FORGES_MAP[Number(forge) as keyof typeof FORGES_MAP];

  if (!forgeAsString) {
    throw new Error(`Invalid forge value: ${forge}.`);
  }

  return forgeAsString;
}

export function toReadable(bytes: string): string {
  return ethers.toUtf8String(bytes);
}

export function calculateProjectStatus(
  project: GitProjectModel,
): ProjectVerificationStatus {
  if (!project.ownerAddress && !project.color) {
    return ProjectVerificationStatus.Unclaimed;
  }

  if (project.ownerAddress && project.color) {
    return ProjectVerificationStatus.Claimed;
  }

  if (project.ownerAddress && !project.color) {
    return ProjectVerificationStatus.PendingMetadata;
  }

  if (!project.ownerAddress && project.color) {
    return ProjectVerificationStatus.PendingOwner;
  }

  return unreachableError(
    `Project with ID ${project.id} (${project.name}) has an invalid status.
    \r\tProject: ${JSON.stringify(project, null, 2)}`,
  );
}
