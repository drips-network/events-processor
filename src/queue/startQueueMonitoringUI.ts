import express from 'express';
import Arena from 'bull-arena';
import BeeQueue from 'bee-queue';
import appSettings from '../config/appSettings';
import logger from '../core/logger';

export default function startQueueMonitoringUI() {
  const app = express();

  const arenaConfig = Arena(
    {
      Bee: BeeQueue,
      queues: [
        {
          type: 'bee',
          name: `${appSettings.network}_events`,
          redis: {
            url: appSettings.redisConnectionString,
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

  const port = appSettings.queueUiPort;

  app.listen(port, () => {
    logger.info(`Monitor Drips Queues on http://localhost:${port}`);
  });
}
