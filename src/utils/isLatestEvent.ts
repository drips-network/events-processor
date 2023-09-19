import type { Model, Transaction, FindOptions, WhereOptions } from 'sequelize';
import type { IEventModel } from '../common/types';

export default async function isLatestEvent<
  T extends IEventModel & Model<any, any>,
>(
  instance: T,
  model: { findOne(options: FindOptions<T>): Promise<T | null> },
  where: WhereOptions<T>,
  transaction: Transaction,
): Promise<boolean> {
  const latestEvent = await model.findOne({
    lock: true,
    transaction,
    where,
    order: [
      ['logIndex', 'DESC'],
      ['blockNumber', 'DESC'],
    ],
  });

  if (!latestEvent) {
    return true;
  }

  if (
    latestEvent.blockNumber > instance.blockNumber ||
    (latestEvent.blockNumber === instance.blockNumber &&
      latestEvent.logIndex > instance.logIndex)
  ) {
    return false;
  }

  return true;
}
