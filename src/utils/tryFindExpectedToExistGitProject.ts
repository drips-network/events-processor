import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import GitProjectModel from '../models/GitProjectModel';
import retryOperation from './retryOperation';
import { logRequestDebug } from './logRequest';

export default async function tryFindExpectedToExistGitProject(
  caller: string,
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
      const errorMessage = `Git project with accountId ${accountId} was not found but it was expected to exist. Retrying because it's possible that the event that creates the project was not processed yet...`;

      logRequestDebug(caller, errorMessage, requestId);

      throw new Error(errorMessage);
    }

    return gitProject;
  });

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}
