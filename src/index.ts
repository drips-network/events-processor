import logger from './core/logger';
import processPastEvents from './core/processPastEvents';

import appSettings from './config/appSettings';
import initJobProcessingQueue from './queue/initJobProcessingQueue';
import startQueueMonitoringUI from './queue/startQueueMonitoringUI';
import { connectToDb } from './db/database';
import {
  registerEventHandlers,
  registerEventListeners,
} from './events/registrations';

(async () => {
  try {
    logger.info('Starting the application...');
    logger.info(`App Settings: ${JSON.stringify(appSettings, null, 2)}`);

    await connectToDb();
    await initJobProcessingQueue();
    registerEventHandlers();
    registerEventListeners();
    if (appSettings.shouldStartMonitoringUI) {
      startQueueMonitoringUI();
    }
    if (appSettings.shouldProcessPastEvents) {
      await processPastEvents();
    }
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
