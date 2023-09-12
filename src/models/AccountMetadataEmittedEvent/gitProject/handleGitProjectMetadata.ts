import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { KnownAny, ProjectId } from '../../../common/types';
import GitProjectModel from '../../GitProjectModel';
import { logRequestDebug } from '../../../utils/logRequest';
import getProjectMetadata from './getProjectMetadata';
import validateProjectMetadata from './validateProjectMetadata';
import createDbEntriesForProjectSplits from './createDbEntriesForProjectSplits';

export default async function handleGitProjectMetadata(
  projectId: ProjectId,
  transaction: Transaction,
  requestId: UUID,
  ipfsHashBytes: string,
): Promise<void> {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    const errorMessage = `Git Project with ID ${projectId} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`;

    logRequestDebug(errorMessage, requestId);
    throw new Error(errorMessage);
  }

  const metadata = await getProjectMetadata(projectId, ipfsHashBytes);

  validateProjectMetadata(project, metadata);

  const { color, emoji, source, splits, description } = metadata;

  project.color = color;
  project.emoji = emoji;
  project.url = source.url;
  project.ownerName = source.ownerName;
  project.description = description ?? null;
  project.verificationStatus = GitProjectModel.calculateStatus(project);

  await project.save({ transaction, requestId } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.

  await createDbEntriesForProjectSplits(
    project.id,
    splits,
    requestId,
    transaction,
  );
}
