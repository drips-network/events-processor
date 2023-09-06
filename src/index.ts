import logger from './common/logger';
import registerServices from './common/registrations';
import connectToDb from './db/database';
import processPastEvents from './utils/processPastEvents';
import validateNetworkSettings from './utils/validateConfig';
import { setupQueueUi, startQueueProcessing } from './queue';

// ! TODO: the app is designed to run on a ONE node for simplicity, based on the expected data volume.
// ! Benchmark, and if we need to scale and process in parallel, prevent duplicate processing of events.
(async () => {
  try {
    await validateNetworkSettings();
    await startQueueProcessing();
    registerServices();
    await connectToDb();
    setupQueueUi();
    await processPastEvents();
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
