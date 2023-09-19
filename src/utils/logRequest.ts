import type { UUID } from 'crypto';
import logger from '../common/logger';

export function logRequestDebug(message: string, requestId: UUID): void {
  logger.debug(`${message}`, { requestId });
}

export function logRequestInfo(message: string, requestId: UUID): void {
  logger.info(`${message}`, { requestId });
}

export function logRequestWarn(message: string, requestId: UUID): void {
  logger.warn(`${message}`, { requestId });
}

export function logRequestError(message: string, requestId: UUID): void {
  logger.error(`${message}`, { requestId });
}
