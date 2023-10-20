import logger from './common/logger';
import registerServices from './common/registrations';
import connectToDb from './db/database';
import processPastEvents from './utils/processPastEvents';
import validateNetworkSettings from './utils/validateConfig';
import { setupQueueUi, startQueueProcessing } from './queue';
import config from './db/config';

(async () => {
  try {
    registerServices();
    await validateNetworkSettings();
    await startQueueProcessing();
    await connectToDb();
    setupQueueUi();
    if (config.shouldProcessPastEvents) {
      await processPastEvents();
    }
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
