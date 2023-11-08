import logger from './common/logger';
import configureEventServices from './eventsConfiguration/configureEventServices';
import connectToDb from './db/database';
import processPastEvents from './utils/processPastEvents';
import validateNetworkSettings from './utils/validateConfig';
import config from './common/appSettings';
import startQueueProcessing from './queue/process';
import setupQueueUI from './queue/ui';

(async () => {
  try {
    logger.debug('Starting the application...');

    configureEventServices();
    await validateNetworkSettings();
    await startQueueProcessing();
    await connectToDb();
    setupQueueUI();

    if (config.shouldProcessPastEvents) {
      await processPastEvents();
    }
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
