import type { UUID } from 'crypto';
import type { Model } from 'sequelize';
import logger from './logger';

export type ChangedProperties = {
  [key: string]: { old: any; new: any };
};

export default class LogManager {
  private readonly _logs: string[] = [];
  private readonly _requestId: UUID;

  public constructor(requestId: UUID) {
    this._requestId = requestId;
  }

  public static nameOfType<T>(type: { new (): T }) {
    return type.prototype.constructor.name;
  }

  public static getChangedProperties<T extends Model>(
    instance: T,
  ): ChangedProperties | null {
    const changedKeys = instance.changed();

    if (!changedKeys) {
      return null;
    }

    const changedProps: ChangedProperties = {};

    if (changedKeys && changedKeys.length > 0) {
      for (const key of changedKeys) {
        changedProps[key] = {
          old: instance.previous(key),
          new: instance.get(key),
        };
      }
    }

    return changedProps;
  }

  public appendFindOrCreateLog<T extends Model>(
    type: { new (): T },
    isCreated: boolean,
    id: string,
  ): this {
    this._logs.push(
      `${
        isCreated
          ? `Created a new ${LogManager.nameOfType(type)} with ID ${id}.`
          : `${LogManager.nameOfType(
              type,
            )} with ID ${id} already exists. Probably it was created by another event. Skipping creation.`
      }`,
    );

    return this;
  }

  public appendCreateLog<T extends Model>(
    type: { new (): T },
    id: string,
  ): this {
    this._logs.push(
      `Created a new ${LogManager.nameOfType(type)} with ID ${id}.`,
    );

    return this;
  }

  public appendUpsertLog<T extends Model>(
    instance: T,
    type: { new (): T },
    id: string,
    wasCreated: boolean,
  ): this {
    const action = wasCreated ? 'Created new' : 'Upserted existing';
    const baseMessage = `${action} ${LogManager.nameOfType(type)} with ID ${id}.`;

    if (wasCreated) {
      this._logs.push(baseMessage);
    } else {
      const changes = LogManager.getChangedProperties(instance);

      const formattedChanges =
        changes && Object.keys(changes).length > 0
          ? `\n\tChanged properties:\n${JSON.stringify(changes, null, 2)
              .split('\n')
              .map((line) => `\t  ${line}`)
              .join('\n')}`
          : `\n\tNo changes detected.`;

      this._logs.push(`${baseMessage}${formattedChanges}`);
    }

    return this;
  }

  public appendLog(log: string): this {
    this._logs.push(log);

    return this;
  }

  public appendUpdateLog<T extends Model>(
    instance: T,
    type: { new (): T },
    id: string,
  ): this {
    const changes = LogManager.getChangedProperties(instance);

    const formattedChanges =
      changes && Object.keys(changes).length > 0
        ? `\n\tChanged properties:\n${JSON.stringify(changes, null, 2)
            .split('\n')
            .map((line) => `\t  ${line}`)
            .join('\n')}`
        : `\n\tNo changes detected.`;

    this._logs.push(
      `Updated ${LogManager.nameOfType(type)} with ID ${id}:${formattedChanges}`,
    );

    return this;
  }

  public logAllInfo(handler: string): void {
    const formattedLogs = this._logs.map((log) => `\t - ${log}`).join('\n');
    const message = `${handler} completed successfully. The following happened:\n${formattedLogs}`;

    LogManager.logRequestInfo(message, this._requestId);
  }

  public static logRequestDebug(message: string, requestId: UUID): void {
    logger.debug(`[${requestId}] ${message}`);
  }

  public static logRequestInfo(message: string, requestId: UUID): void {
    logger.info(`[${requestId}] ${message}`);
  }

  public static logRequestWarn(message: string, requestId: UUID): void {
    logger.warn(`[${requestId}] ${message}`);
  }

  public static logRequestError(message: string, requestId: UUID): void {
    logger.error(`[${requestId}] ${message}`);
  }
}
