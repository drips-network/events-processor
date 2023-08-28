import type { UUID } from 'crypto';
import logger from '../common/logger';

export function logRequestDebug(
  caller: string,
  message: string,
  requestId: UUID,
): void {
  logger.debug(`${caller} - ${message}`, { requestId });
}

export function logRequestInfo(
  caller: string,
  message: string,
  requestId: UUID,
): void {
  logger.info(`${caller} - ${message}`, { requestId });
}

export function logRequestWarn(
  caller: string,
  message: string,
  requestId: UUID,
): void {
  logger.warn(`${caller} - ${message}`, { requestId });
}

export function logRequestError(
  caller: string,
  message: string,
  requestId: UUID,
): void {
  logger.error(`${caller} - ${message}`, { requestId });
}

export function nameOfType<T>(type: { new (): T }) {
  return type.prototype.constructor.name;
}
