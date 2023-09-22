import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { ProjectId } from '../../../common/types';
import { GitProjectModel } from '../../../models';
import getProjectMetadata from './getProjectMetadata';
import validateProjectMetadata from './validateProjectMetadata';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import type LogManager from '../../../common/LogManager';
import { calculateProjectStatus } from '../../../utils/gitProjectUtils';

export default async function updateGitProjectMetadata(
  projectId: ProjectId,
  logManager: LogManager,
  transaction: Transaction,
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    throw new Error(
      `Failed to update the metadata of Git Project with ID ${projectId}: the project does not exist in the database. 
      Make sure the 'OwnerUpdatedRequested' event that should have created the project was processed or the account metadata were not emitted manually.`,
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
  project.verificationStatus = calculateProjectStatus(project);

  logManager.appendUpdateLog(project, GitProjectModel, project.id);

  await project.save({ transaction });

  return metadata;
}
