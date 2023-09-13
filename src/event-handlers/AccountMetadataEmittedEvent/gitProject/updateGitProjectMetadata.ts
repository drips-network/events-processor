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

  if (!project) {
    throw new Error(
      `Git Project with ID ${project} was not found, but it was expected to exist. The event that should have created the Git Project may not have been processed yet.`,
    );
  }

  const metadata = await getProjectMetadata(projectId, ipfsHashBytes);

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
