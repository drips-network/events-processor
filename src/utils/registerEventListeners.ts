import getRegisteredEvents from './getRegisteredEvents';
import logger from '../common/logger';
import getEventHandlerByFilterSignature from './getEventHandler';

export default async function registerEventListeners(): Promise<void> {
  const registeredEvents = getRegisteredEvents();

  logger.info(`Registering listeners for ${registeredEvents.length} events...`);

  registeredEvents.forEach(async (filterSignature) => {
    getEventHandlerByFilterSignature(filterSignature).registerEventListener();

    logger.info(`Registered listener for filter ${filterSignature}.`);
  });
}
