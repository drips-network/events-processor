import dotenv from 'dotenv';
import run from './worker';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

(async () => {
  try {
    await run();
  } catch (e) {
    // TODO: add logger
    console.error(e);
  }
})();
