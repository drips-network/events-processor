import { hexlify, toUtf8Bytes } from 'ethers';
import type { z } from 'zod';
import unreachableError from './unreachableError';
import type ProjectModel from '../models/ProjectModel';
import type { Forge, ProjectVerificationStatus } from '../models/ProjectModel';
import { repoDriverContract } from '../core/contractClients';
import type { sourceSchema } from '../metadata/schemas/common/sources';
import { assertIsRepoSubAccountDriverId } from './accountIdUtils';

export function convertForgeToNumber(forge: Forge) {
  switch (forge) {
    case 'github':
      return 0;
    case 'gitlab':
      return 1;
    default:
      return unreachableError(
        `Failed to convert: '${forge}' is not a valid forge.`,
      );
  }
}

export function calculateProjectStatus(
  project: ProjectModel,
): ProjectVerificationStatus {
  const hasOwner = Boolean(project.ownerAddress);
  const hasMetadata = Boolean(project.lastProcessedIpfsHash);

  if (hasOwner && hasMetadata) {
    return 'claimed';
  }

  if (!hasOwner && !hasMetadata) {
    return 'unclaimed';
  }

  if (hasOwner) {
    return 'pending_metadata';
  }

  return unreachableError(
    `Invalid project status: hasOwner=${hasOwner}, hasMetadata=${hasMetadata}`,
  );
}

export async function verifyProjectSources(
  projects: {
    accountId: string;
    source: z.infer<typeof sourceSchema>;
  }[],
): Promise<{
  areProjectsValid: boolean;
  message?: string;
}> {
  const errors: string[] = [];

  for (const {
    accountId,
    source: { forge, ownerName, repoName },
  } of projects) {
    assertIsRepoSubAccountDriverId(accountId);

    const calculatedAccountId = await repoDriverContract.calcAccountId(
      convertForgeToNumber(forge),
      hexlify(toUtf8Bytes(`${ownerName}/${repoName}`)),
    );

    if (calculatedAccountId.toString() !== accountId) {
      errors.push(
        `Mismatch for '${ownerName}/${repoName}' on '${forge}': expected '${accountId}', got '${calculatedAccountId}'.`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      areProjectsValid: false,
      message: `Failed to verify project sources:\n${errors.join('\n')}`,
    };
  }

  return {
    areProjectsValid: true,
  };
}
