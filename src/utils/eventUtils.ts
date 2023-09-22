import type { FindOptions, Model, Transaction, WhereOptions } from 'sequelize';
import {
  Drips__factory,
  NftDriver__factory,
  RepoDriver__factory,
} from '../../contracts';
import type {
  DripsEvent,
  DripsEventSignature,
  EventSignature,
  IEventModel,
  NftDriverEventSignature,
  RepoDriverEventSignature,
} from '../common/types';
import {
  getDripsClient,
  getNftDriverClient,
  getRepoDriverClient,
} from './contractClientUtils';
import shouldNeverHappen from './shouldNeverHappen';

export function isDripsEvent(
  event: EventSignature,
): event is DripsEventSignature {
  return Drips__factory.createInterface().hasEvent(event);
}

export function isNftDriverEvent(
  event: EventSignature,
): event is NftDriverEventSignature {
  return NftDriver__factory.createInterface().hasEvent(event);
}

export function isRepoDriverEvent(
  event: EventSignature,
): event is RepoDriverEventSignature {
  return RepoDriver__factory.createInterface().hasEvent(event);
}

export async function getTypedEvent(
  eventSignature: EventSignature,
): Promise<DripsEvent> {
  if (isDripsEvent(eventSignature)) {
    const drips = await getDripsClient();
    return drips.filters[eventSignature];
  }

  if (isNftDriverEvent(eventSignature)) {
    const nftDriver = await getNftDriverClient();
    return nftDriver.filters[eventSignature];
  }

  if (isRepoDriverEvent(eventSignature)) {
    const repoDriver = await getRepoDriverClient();
    return repoDriver.filters[eventSignature];
  }

  return shouldNeverHappen(
    `No event found for filter signature ${eventSignature}.`,
  );
}

export async function isLatestEvent<T extends IEventModel & Model<any, any>>(
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
