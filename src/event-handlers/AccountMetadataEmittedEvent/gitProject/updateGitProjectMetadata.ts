import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { ProjectId } from '../../../common/types';
import { GitProjectModel } from '../../../models';
import getProjectMetadata from './getProjectMetadata';
import validateProjectMetadata from './validateProjectMetadata';
import getChangedProperties from '../../../utils/getChangedProperties';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';

export default async function updateGitProjectMetadata(
  projectId: ProjectId,
  logs: string[],
  transaction: Transaction,
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  // Because we filter on metadata emitted only by the Drips App we expect the project and the metadata to (eventually) exist.

  if (!project) {
    throw new Error(
      `Attempted to update metadata for Git Project with ID ${projectId}, but this project does not exist in the database. 
      The event that should have created the project may still need to be processed. 
      If the error persists and the job fails after completing all retries, ensure the account metadata were not emitted MANUALLY (having the same key as the Drips App). 
      Check the logs for more details.`,
    );
  }

  const metadata = await getProjectMetadata(ipfsHashBytes);

  if (!metadata) {
    throw new Error(
      `Project metadata not found for Git Project with ID ${projectId} but it was expected to exist.`,
    );
  }

  validateProjectMetadata(project, metadata);

  const { color, emoji, source, description } = metadata;

  project.color = color;
  project.emoji = emoji;
  project.url = source.url;
  project.ownerName = source.ownerName;
  project.description = description ?? null;
  project.splitsJson = JSON.stringify(metadata.splits);
  project.verificationStatus = GitProjectModel.calculateStatus(project);

  logs.push(
    `Incoming event was the latest for Git Project with ID ${projectId}. The Git Project metadata was updated: ${JSON.stringify(
      getChangedProperties(project),
    )}.`,
  );

  await project.save({ transaction });

  return metadata;
}
