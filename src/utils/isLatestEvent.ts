import {
  type FindOptions,
  type Model,
  type Transaction,
  type WhereOptions,
} from 'sequelize';
import type { IEventModel } from '../events/types';

export async function isLatestEvent<T extends IEventModel & Model<any, any>>(
  incomingEvent: T,
  model: { findOne(options: FindOptions<T>): Promise<T | null> },
  where: WhereOptions<T>,
  transaction: Transaction,
): Promise<boolean> {
  const latest = await model.findOne({
    lock: transaction.LOCK.UPDATE,
    transaction,
    where,
    order: [
      ['block_number', 'DESC'],
      ['log_index', 'DESC'],
    ],
  });

  if (!latest) {
    return true;
  }

  const isNewerBlock = latest.blockNumber < incomingEvent.blockNumber;
  const isSameBlockNewerLog =
    latest.blockNumber === incomingEvent.blockNumber &&
    latest.logIndex <= incomingEvent.logIndex;

  return isNewerBlock || isSameBlockNewerLog;
}
