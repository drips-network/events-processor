import type { FindOptions, Model, Transaction, WhereOptions } from 'sequelize';
import type { IEventModel } from '../events/types';

export async function isLatestEvent<T extends IEventModel & Model<any, any>>(
  incomingEvent: T,
  model: { findOne(options: FindOptions<T>): Promise<T | null> },
  where: WhereOptions<T>,
  transaction: Transaction,
): Promise<boolean> {
  const latestEventInDb = await model.findOne({
    lock: true,
    transaction,
    where,
    order: [
      ['blockNumber', 'DESC'],
      ['logIndex', 'DESC'],
    ],
  });

  if (!latestEventInDb) {
    return true;
  }

  if (
    latestEventInDb.blockNumber > incomingEvent.blockNumber ||
    (latestEventInDb.blockNumber === incomingEvent.blockNumber &&
      latestEventInDb.logIndex > incomingEvent.logIndex)
  ) {
    return false;
  }

  return true;
}
