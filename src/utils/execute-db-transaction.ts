import { BaseError, type Transaction } from 'sequelize';
import logger from '../common/logger';
import sequelizeInstance from './get-sequelize-instance';
import type { UUID } from '../common/types';

export default async function executeDbTransaction<T>(
  callback: (t: Transaction) => PromiseLike<T>,
  requestId: UUID,
): Promise<T> {
  try {
    return await sequelizeInstance.transaction(callback);
    // Committed
  } catch (error: any) {
    // Rolled back
    const errorMessage = `[${requestId}] Database transaction from request ${requestId} failed and rolled back with error`;
    if (error instanceof BaseError) {
      logger.debug(`${errorMessage} '${JSON.stringify(error, null, 2)}'.`);
    } else {
      logger.debug(`${errorMessage} '${error.message}'.`);
    }

    throw error;
  }
}
