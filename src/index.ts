import logger from './common/logger';
import connectToDb from './db';
import processPastEvents from './utils/processPastEvents';
import registerEventListeners from './utils/registerEventListeners';
import validateNetworkSettings from './utils/validateConfig';

(async () => {
  try {
    await validateNetworkSettings();
    await registerEventListeners();
    await connectToDb();
    await processPastEvents();
    logger.info('Listening for events...');
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
