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
  const { url, repoName, ownerName } = source;
  const { name: projectName, id: projectId } = project;

  if (`${ownerName}/${repoName}` !== `${projectName}`) {
    errors.push(`repoName mismatch: got ${repoName}, expected ${projectName}.`);
  }

  if (!url.includes(repoName)) {
    errors.push(
      `URL does not include repoName: ${projectName} not found in ${url}.`,
    );
  }

  if (describes.accountId !== projectId) {
    errors.push(
      `accountId mismatch with: got ${describes.accountId}, expected ${projectId}.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Git Project with ID ${projectId} has metadata that does not match the metadata emitted by the contract (${errors.join(
        '; ',
      )}).`,
    );
  }
}
