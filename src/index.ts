import logger from './common/logger';
import connectToDb from './db/database';
import processPastEvents from './utils/processPastEvents';
import registerEventListeners from './utils/registerEventListeners';
import validateNetworkSettings from './utils/validateConfig';

// ! TODO: the app is designed to run on a ONE node for simplicity, based on the expected data volume.
// ! Benchmark, and if we need to scale and process in parallel, prevent duplicate processing of events.

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
