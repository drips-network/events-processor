import { closeQueue } from './src/queue/queue';

afterAll(async () => {
  await closeQueue();
});
