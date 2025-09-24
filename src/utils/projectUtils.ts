import { hexlify, toUtf8Bytes } from 'ethers';
import type { z } from 'zod';
import unreachableError from './unreachableError';
import type ProjectModel from '../models/ProjectModel';
import type { Forge, ProjectVerificationStatus } from '../models/ProjectModel';
import { repoDriverContract } from '../core/contractClients';
import type { gitHubSourceSchema } from '../metadata/schemas/common/sources';
import {
  calcParentRepoDriverId,
  isRepoDriverId,
  isRepoSubAccountDriverId,
} from './accountIdUtils';

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

export async function calcProjectId(
  forge: Forge,
  owner: string,
  repo: string,
): Promise<string> {
  const accountId = await repoDriverContract.calcAccountId(
    convertForgeToNumber(forge),
    hexlify(toUtf8Bytes(`${owner}/${repo}`)),
  );
  return accountId.toString();
}

export async function verifyProjectSource(
  accountId: string,
  source: z.infer<typeof gitHubSourceSchema>,
): Promise<{ isValid: true } | { isValid: false; message: string }> {
  const { forge, ownerName, repoName } = source;
  const isSubAccount = isRepoSubAccountDriverId(accountId.toString());
  const isParentAccount = isRepoDriverId(accountId.toString());

  if (!isSubAccount && !isParentAccount) {
    unreachableError(
      `Invalid account ID: '${accountId}' is not a valid RepoDriver or RepoSubAccount ID.`,
    );
  }

  const calculatedParentAccountId = await calcProjectId(
    forge,
    ownerName,
    repoName,
  );

  if (isSubAccount) {
    const parentId = await calcParentRepoDriverId(accountId);

    if (parentId !== calculatedParentAccountId.toString()) {
      return {
        isValid: false,
        message: `Mismatch for '${ownerName}/${repoName}' on '${forge}': for sub account '${accountId}', expected parent '${calculatedParentAccountId}', got '${parentId}'.`,
      };
    }
  } else if (accountId !== calculatedParentAccountId.toString()) {
    return {
      isValid: false,
      message: `Mismatch for '${ownerName}/${repoName}' on '${forge}': expected parent account '${calculatedParentAccountId}', got '${accountId}'.`,
    };
  }

  return { isValid: true };
}

export async function verifyProjectSources(
  projects: {
    accountId: string;
    source: z.infer<typeof gitHubSourceSchema>;
  }[],
): Promise<{ isValid: true } | { isValid: false; message: string }> {
  // Parallelize all verification calls to fix N+1 problem and sequential processing
  const verificationResults = await Promise.all(
    projects.map(({ accountId, source }) =>
      verifyProjectSource(accountId, source),
    ),
  );

  const errors: string[] = [];
  for (const result of verificationResults) {
    if (!result.isValid) {
      errors.push(result.message);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      message: `Failed to verify project sources:\n${errors.join('\n')}`,
    };
  }

  return { isValid: true };
}
