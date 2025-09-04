import BeeQueue from 'bee-queue';
import { createClient } from 'redis';
import appSettings from '../config/appSettings';
import logger from '../core/logger';
import type { EventSignature } from '../events/types';

const redisClient = createClient({
  url: appSettings.redisConnectionString,
});

const eventProcessingQueue = new BeeQueue<{
  logIndex: number;
  eventSignature: EventSignature;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
  args: string;
}>(`${appSettings.network}_events`, {
  activateDelayedJobs: true,
  redis: redisClient,
});

eventProcessingQueue.checkStalledJobs(8000, (err, numStalledJobs) => {
  if (err) {
    logger.error(
      `❌ Queue stalled jobs check error (num: ${numStalledJobs}): ${err.message}.`,
    );
  }
});

eventProcessingQueue.on('error', (error: Error) => {
  logger.error(`❌ Queue error: ${error.message}.`);
});

eventProcessingQueue.on('job succeeded', (job) => {
  logger.info(`✅ [${job}] completed successfully.`);
});

eventProcessingQueue.on('job failed', (job, err) => {
  logger.error(`❌ [${job}] failed: ${err.message}`);
});

eventProcessingQueue.on('job retrying', (job, err) => {
  logger.info(`♻️ [${job}] failed (will be retried): ${err.message}`);
});

export default eventProcessingQueue;
