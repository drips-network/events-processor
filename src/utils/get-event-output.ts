import type { TypedEventLog } from '../../contracts/common';
import type {
  DripsEvent,
  DripsEventOutputTuple,
  RepoDriverEvent,
  RepoDriverEventOutputTuple,
  SupportedDripsFilterSignature,
  SupportedEvent,
  SupportedOutputTuple,
  SupportedRepoDriverFilterSignature,
} from '../common/types';
import { getDrips, getRepoDriver } from './get-contract';
import { isDripsEvent, isRepoDriverEvent } from './is-event-of-contract';

async function getRepoDriverEventOutput<T extends RepoDriverEventOutputTuple>(
  eventLog: TypedEventLog<RepoDriverEvent>,
): Promise<T> {
  const repoDriver = await getRepoDriver();

  const logDescription = repoDriver.interface.parseLog({
    ...eventLog,
    data: eventLog.data,
    topics: Array.from(eventLog.topics),
  });

  if (!logDescription) {
    throw new Error(
      `Failed to parse ${
        eventLog.eventName
      } event from event log: ${JSON.stringify(eventLog)}`,
    );
  }

  return logDescription.args as unknown as T;
}

async function getDripsEventOutput<T extends DripsEventOutputTuple>(
  eventLog: TypedEventLog<DripsEvent>,
): Promise<T> {
  const drips = await getDrips();

  const logDescription = drips.interface.parseLog({
    ...eventLog,
    data: eventLog.data,
    topics: Array.from(eventLog.topics),
  });

  if (!logDescription) {
    throw new Error(
      `Failed to parse ${
        eventLog.eventName
      } event from event log: ${JSON.stringify(eventLog)}`,
    );
  }

  return logDescription.args as unknown as T;
}

export default async function getEventOutput<T extends SupportedOutputTuple>(
  eventLog: TypedEventLog<SupportedEvent>,
) {
  // TODO: add support for other contracts.

  const drips = await getDrips();
  if (
    isDripsEvent(
      eventLog.eventSignature as SupportedDripsFilterSignature,
      drips,
    )
  ) {
    return getDripsEventOutput(
      eventLog as TypedEventLog<DripsEvent>,
    ) as unknown as T;
  }

  const repoDriver = await getRepoDriver();
  if (
    isRepoDriverEvent(
      eventLog.eventSignature as SupportedRepoDriverFilterSignature,
      repoDriver,
    )
  ) {
    return getRepoDriverEventOutput(
      eventLog as TypedEventLog<RepoDriverEvent>,
    ) as unknown as T;
  }

  throw new Error(
    `Failed to parse event log: no event found for event name ${eventLog.eventName}.`,
  );
}
