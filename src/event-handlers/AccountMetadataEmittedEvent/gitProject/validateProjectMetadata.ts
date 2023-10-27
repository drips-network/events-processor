import type { AnyVersion } from '@efstajas/versioned-parser';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type { GitProjectModel } from '../../../models';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';

export default async function validateProjectMetadata(
  project: GitProjectModel,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  if (!metadata) {
    shouldNeverHappen(
      `Metadata for Git Project with ID ${project.id} is null.`,
    );
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
