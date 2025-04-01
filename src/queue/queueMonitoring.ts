import Arena from 'bull-arena';
import BeeQueue from 'bee-queue';
import appSettings from '../config/appSettings';

export const arenaConfig = Arena(
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
