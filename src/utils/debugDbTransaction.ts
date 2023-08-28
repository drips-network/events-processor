import { BaseError, type Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import logger from '../common/logger';
import sequelizeInstance from './getSequelizeInstance';

export default async function debugDbTransaction<T>(
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
