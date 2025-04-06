import type { z } from 'zod';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { hexlify, toUtf8Bytes } from 'ethers';
import { repoDriverContract } from '../../core/contractClients';
import type { dripListSplitReceiverSchema } from '../../metadata/schemas/nft-driver/v2';
import type {
  repoDriverSplitReceiverSchema,
  addressDriverSplitReceiverSchema,
} from '../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../metadata/schemas/sub-list/v1';
import type { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import type { ProjectModel } from '../../models';
import unreachableError from '../../utils/unreachableError';

export default async function verifyProjectSources(
  recipients: (
    | z.infer<typeof repoDriverSplitReceiverSchema>
    | z.infer<typeof subListSplitReceiverSchema>
    | z.infer<typeof addressDriverSplitReceiverSchema>
    | z.infer<typeof dripListSplitReceiverSchema>
  )[],
) {
  for (const r of recipients) {
    if (r.type === 'repoDriver') {
      const accountId = await repoDriverContract.calcAccountId(
        r.source.forge === 'github'
          ? 0
          : unreachableError(`Unexpected forge: ${r.source.forge}`),
        hexlify(toUtf8Bytes(`${r.source.ownerName}/${r.source.repoName}`)),
      );

      if (accountId.toString() !== r.accountId) {
        throw new Error(
          `Failed to verify Project's source: calculated accountId '${accountId}' does not match the one in metadata ('${r.accountId}') for repo '${r.source.ownerName}/${r.source.repoName}' on '${r.source.forge}'.`,
        );
      }
    }
  }
}

export async function verifyProjectMetadata(
  onChainProject: ProjectModel,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  const errors: string[] = [];

  const {
    id: onChainProjectId,
    name: onChainProjectName,
    url: onChainProjectUrl,
  } = onChainProject;

  const {
    describes,
    source: {
      url: metadataUrl,
      repoName: metadataRepoName,
      ownerName: metadataOwnerName,
    },
  } = metadata;

  if (`${metadataOwnerName}/${metadataRepoName}` !== onChainProjectName) {
    errors.push(
      `- Repo name mismatch: got '${metadataOwnerName}/${metadataRepoName}', expected '${onChainProjectName}'.`,
    );
  }

  if (metadataUrl !== onChainProjectUrl) {
    errors.push(
      `- URL mismatch: got '${metadataUrl}', expected '${onChainProjectUrl}'.`,
    );
  }

  if (describes.accountId !== onChainProjectId) {
    errors.push(
      `- Account ID mismatch: got '${describes.accountId}', expected '${onChainProjectId}'.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Project metadata mismatch for project ID '${onChainProjectId}':\n${errors.join(
        '\n',
      )}`,
    );
  }
}
