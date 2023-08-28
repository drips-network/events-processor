import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import GitProjectModel from '../models/GitProjectModel';
import retryOperation from './retryOperation';
import { logRequestDebug } from './logRequest';

export default async function tryFindExpectedToExistGitProject(
  requestId: UUID,
  accountId: string,
  transaction: Transaction,
): Promise<GitProjectModel> {
  const result = await retryOperation(async () => {
    const gitProject = await GitProjectModel.findOne({
      where: {
        accountId,
      },
      transaction,
    });

    if (!gitProject) {
      const errorMessage = `Git project with accountId ${accountId} was not found but it was expected to exist. Maybe the event that should have created the project is not processed yet. Retrying...`;

      logRequestDebug(errorMessage, requestId);

      throw new Error(errorMessage);
    }

    return gitProject;
  });

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}
