import logger from './common/logger';
import connectToDb from './db';
import processPastEvents from './utils/process-past-events';
import registerOnReceives from './utils/register-event-on-receive-listeners';
import validateNetworkSettings from './utils/validate-config';

(async () => {
  try {
    await validateNetworkSettings();
    await registerOnReceives();
    await connectToDb();
    await processPastEvents();
    logger.info('Listening for events...');
  } catch (e: any) {
    logger.error(`Unhandled error: ${e.message}`);
  }
})();
