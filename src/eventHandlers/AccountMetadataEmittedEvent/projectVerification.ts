import type { z } from 'zod';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { repoDriverContract } from '../../core/contractClients';
import type { dripListSplitReceiverSchema } from '../../metadata/schemas/nft-driver/v2';
import type {
  repoDriverSplitReceiverSchema,
  addressDriverSplitReceiverSchema,
} from '../../metadata/schemas/repo-driver/v2';
import type { subListSplitReceiverSchema } from '../../metadata/schemas/sub-list/v1';
import type { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import type { GitProjectModel } from '../../models';
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
        r.source.forge,
        `${r.source.ownerName}/${r.source.repoName}`,
      );

      if (accountId.toString() !== r.accountId) {
        throw new Error(
          `Calculated project accountId '${accountId}' does not match the one in metadata ('${r.accountId}') for repo '${r.source.ownerName}/${r.source.repoName}' on '${r.source.forge}'.`,
        );
      }
    }
  }
}

export async function verifyProjectMetadata(
  project: GitProjectModel,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  if (!metadata) {
    unreachableError(`Metadata for Git Project with ID ${project.id} is null.`);
  }

  const errors = [];

  const { describes, source } = metadata;
  const {
    url: metaUrl,
    repoName: metaRepoName,
    ownerName: metaOwnerName,
  } = source;
  const { id: onChainProjectId, name: onChainProjectName } = project;

  if (`${metaOwnerName}/${metaRepoName}` !== `${onChainProjectName}`) {
    errors.push(
      `repoName mismatch: got ${metaOwnerName}/${metaRepoName}, expected ${onChainProjectName}.`,
    );
  }

  if (metaUrl !== project.url) {
    errors.push(`url mismatch: got ${metaUrl}, expected ${project.url}.`);
  }

  if (describes.accountId !== onChainProjectId) {
    errors.push(
      `accountId mismatch with: got ${describes.accountId}, expected ${onChainProjectId}.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Git Project with ID ${onChainProjectId} has metadata that does not match the metadata emitted by the contract (${errors.join(
        '; ',
      )}).`,
    );
  }
}
