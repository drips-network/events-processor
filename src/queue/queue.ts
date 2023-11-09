import BeeQueue from 'bee-queue';
import config from '../config/appSettings';
import logger from '../core/logger';
import type { EventSignature } from '../events/types';

const eventProcessingQueue = new BeeQueue<{
  logIndex: number;
  eventSignature: EventSignature;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
  args: string;
}>(`${config.network}_events`, {
  activateDelayedJobs: true,
  redis: { url: config.redisConnectionString },
});

eventProcessingQueue.on('succeeded', (job) => {
  logger.info(`✅ SUCCESS: Job with ID ${job.id} completed successfully.`);
});

eventProcessingQueue.on('job failed', (job, err) => {
  logger.error(
    `❌ FAILED: Job with ID ${job} failed with error '${err.message}'.`,
  );
});

eventProcessingQueue.on('job retrying', (job, err) => {
  logger.debug(
    `♻️  Job with ID ${job} failed with error '${err.message}' but is being retried...`,
  );
});

export default eventProcessingQueue;
