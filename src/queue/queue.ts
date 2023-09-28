import BeeQueue from 'bee-queue';
import type { EventSignature } from '../common/types';
import config from '../db/config';
import logger from '../common/logger';

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
