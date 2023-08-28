import logger from '../common/logger';

export default function logEventOutput<T extends { [key: string]: any }>(
  outputObject: T,
): void {
  for (const [key, value] of Object.entries(outputObject)) {
    logger.info(`Key: ${key}, Value: ${value}`);
  }
}
