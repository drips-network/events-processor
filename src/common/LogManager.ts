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
  ): ChangedProperties {
    const changedKeys = instance.changed();
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
    created: boolean,
    id: string,
  ): this {
    this._logs.push(
      `${
        created
          ? `Created a new ${LogManager.nameOfType(type)} with ID ${id}.`
          : `${LogManager.nameOfType(
              type,
            )} with ID ${id} already exists. Probably it was created by another event. Skipping creation.`
      }`,
    );

    return this;
  }

  public appendIsLatestEventLog(): this {
    this._logs.push(
      'Handled event is the latest event. Models will be updated.',
    );

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
    this._logs.push(
      `Updated ${LogManager.nameOfType(type)} with ID ${id}: ${JSON.stringify(
        LogManager.getChangedProperties(instance),
      )}`,
    );

    return this;
  }

  public logAllDebug(): void {
    LogManager.logRequestDebug(
      `Completed successfully. The following happened:\n\t - ${this._logs.join(
        '\n\t - ',
      )}`,
      this._requestId,
    );
  }

  public static logRequestDebug(message: string, requestId: UUID): void {
    logger.debug(`${message}`, { requestId });
  }

  public static logRequestInfo(message: string, requestId: UUID): void {
    logger.info(`${message}`, { requestId });
  }

  public static logRequestWarn(message: string, requestId: UUID): void {
    logger.warn(`${message}`, { requestId });
  }

  public static logRequestError(message: string, requestId: UUID): void {
    logger.error(`${message}`, { requestId });
  }
}
