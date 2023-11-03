import express from 'express';
import Arena from 'bull-arena';
import BeeQueue from 'bee-queue';
import config from '../db/config';
import logger from '../common/logger';

export default function setupQueueUI() {
  const app = express();

  const arenaConfig = Arena(
    {
      Bee: BeeQueue,
      queues: [
        {
          type: 'bee',
          name: `${config.network}_events`,
          redis: {
            url: config.redisConnectionString,
          },
          hostId: 'drips_queue',
        },
      ],
    },
    {
      basePath: '/',
      disableListen: true,
    },
  );

  app.use('/arena', arenaConfig);

  const port = process.env.QUEUE_UI_PORT ?? 3000;

  app.listen(port, () => {
    logger.info(`Monitor Drips Queues on http://localhost:${port}`);
  });
}
