import { hexlify, toUtf8Bytes, ZeroAddress, type AddressLike } from 'ethers';
import type { z } from 'zod';
import unreachableError from './unreachableError';
import type { Forge, ProjectVerificationStatus } from '../models/ProjectModel';
import { repoDriverContract } from '../core/contractClients';
import type { repoDriverSplitReceiverSchema } from '../metadata/schemas/repo-driver/v2';

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
  owner: AddressLike | null,
): ProjectVerificationStatus {
  if (!owner || owner === ZeroAddress) {
    return 'unclaimed';
  }

  return 'claimed';
}

export async function verifyProjectSources(
  projectReceivers: z.infer<typeof repoDriverSplitReceiverSchema>[],
): Promise<{
  areProjectsValid: boolean;
  message?: string;
}> {
  const errors: string[] = [];

  for (const {
    accountId,
    source: { forge, ownerName, repoName },
  } of projectReceivers) {
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
