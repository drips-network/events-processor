import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import GitProjectModel from '../models/GitProjectModel';
import retryOperation from './retryOperation';
import { logRequestDebug } from './logRequest';

export default async function retryFindProject(
  id: string,
  transaction: Transaction,
  requestId: UUID,
): Promise<GitProjectModel> {
  const result = await retryOperation(async () => {
    const project = await GitProjectModel.findByPk(id, {
      transaction,
    });

    if (!project) {
      const errorMessage = `Git project with ID ${id} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet. Retrying...`;

      logRequestDebug(errorMessage, requestId);
      throw new Error(errorMessage);
    }

    return project;
  });

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}
