import type { AnyVersion } from '@efstajas/versioned-parser';
import type GitProjectModel from '../../GitProjectModel';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';

export default function validateProjectMetadata(
  project: GitProjectModel,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): void {
  if (!metadata) {
    throw new Error(
      `Git Project metadata not found for project with ID ${project.id} but it was expected to exist.`,
    );
  }

  const errors = [];

  const { describes, source } = metadata;
  const { url, repoName, ownerName } = source;
  const { name: projectName, id: projectId } = project;

  if (`${ownerName}/${repoName}` !== `${projectName}`) {
    errors.push(`repoName mismatch: got ${repoName}, expected ${projectName}`);
  }

  if (!url.includes(repoName)) {
    errors.push(
      `URL does not include repoName: ${projectName} not found in ${url}`,
    );
  }

  if (describes.accountId !== projectId) {
    errors.push(
      `accountId mismatch with: got ${describes.accountId}, expected ${projectId}`,
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
