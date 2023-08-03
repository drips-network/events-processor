import getRegisteredEvents from './get-registered-events';
import logger from '../common/logger';
import getEventHandlerByFilterSignature from './get-event-handler';

export default async function registerOnReceives(): Promise<void> {
  const registeredEvents = getRegisteredEvents();

  logger.info(`Registering listeners for ${registeredEvents.length} events...`);

  registeredEvents.forEach(async (filterSignature) => {
    getEventHandlerByFilterSignature(filterSignature).registerEventListener();

    logger.info(`Registered listener for filter ${filterSignature}.`);
  });
}
