import type { AnyVersion } from '@efstajas/versioned-parser';
import type GitProjectModel from '../GitProjectModel';
import type { repoDriverAccountMetadataParser } from '../../metadata/schemas';

export default function validateGitProjectMetadata(
  gitProject: GitProjectModel,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): void {
  const errors = [];

  const { describes, source } = metadata;
  const { url, repoName, ownerName } = source;
  const { name: gitProjectName, accountId: gitProjectAccountId } = gitProject;

  if (`${ownerName}/${repoName}` !== `${gitProjectName}`) {
    errors.push(
      `repoName mismatch: got ${repoName}, expected ${gitProjectName}`,
    );
  }

  if (!url.includes(repoName)) {
    errors.push(
      `URL does not include repoName: ${gitProjectName} not found in ${url}`,
    );
  }

  if (describes.accountId !== gitProjectAccountId) {
    errors.push(
      `accountId mismatch with toString: got ${describes.accountId}, expected ${gitProjectAccountId}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Git project with account ID ${gitProjectAccountId} has metadata that does not match the metadata emitted by the contract (${errors.join(
        '; ',
      )}).`,
    );
  }
}
