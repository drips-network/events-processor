import type { FindOptions, Model, Transaction, WhereOptions } from 'sequelize';
import {
  Drips__factory,
  NftDriver__factory,
  RepoDriver__factory,
} from '../../contracts';
import shouldNeverHappen from './shouldNeverHappen';
import type {
  DripsEventSignature,
  EventSignature,
  IEventModel,
  NftDriverEventSignature,
  RepoDriverEventSignature,
  SupportedEvent,
} from '../events/types';
import {
  dripsContract,
  nftDriverContract,
  repoDriverContract,
} from '../core/contractClients';

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
): Promise<SupportedEvent> {
  if (isDripsEvent(eventSignature)) {
    return dripsContract.filters[eventSignature];
  }

  if (isNftDriverEvent(eventSignature)) {
    return nftDriverContract.filters[eventSignature];
  }

  if (isRepoDriverEvent(eventSignature)) {
    return repoDriverContract.filters[eventSignature];
  }

  return shouldNeverHappen(
    `No event found for filter signature ${eventSignature}.`,
  );
}

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
