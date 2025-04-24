/* eslint-disable no-dupe-class-members */
import type { UUID } from 'crypto';
import type { Model } from 'sequelize';
import logger from './logger';

export type ChangedProperties = {
  [key: string]: { old: any; new: any };
};

/**
 * ScopedLogger buffers context-aware messages for a single handler/request.
 */
export default class ScopedLogger {
  private readonly _handler: string;
  private readonly _requestId: UUID;
  private readonly _buffer: string[] = [];

  constructor(handler: string, requestId: UUID) {
    this._handler = handler;
    this._requestId = requestId;
  }

  /**
   * Buffer a plain text message.
   */
  public bufferMessage(message: string): this {
    this._buffer.push(`[${this._requestId}] ${message}`);
    return this;
  }

  /**
   * Buffer a creation event for a Sequelize model instance.
   */
  public bufferCreation<T extends Model>(opts: {
    input: T;
    type: abstract new (...args: any[]) => T;
    id: string;
  }): this {
    const typeName = this._getClassName(opts.type);
    this._buffer.push(
      `[${this._requestId}] Created new ${typeName} (ID: ${opts.id}).`,
    );

    return this;
  }

  /**
   * Buffer an update event for a Sequelize model instance, including change details.
   */
  public bufferUpdate<T extends Model>(opts: {
    input: T;
    type: abstract new (...args: any[]) => T;
    id: string;
  }): this {
    const changes = this._extractChanges(opts.input) ?? {};
    const changeKeys = Object.keys(changes);
    const typeName = this._getClassName(opts.type);

    let summary: string;
    if (changeKeys.length > 0) {
      summary = `Updated ${typeName} with ${changeKeys.length} change${changeKeys.length > 1 ? 's' : ''}.`;
    } else {
      summary = `No changes detected on ${typeName}.`;
    }

    const formattedChanges = this._formatChanges(changes);
    this._buffer.push(
      `[${this._requestId}] Processed ${typeName} (ID: ${opts.id}) — ${summary}${formattedChanges}`,
    );

    return this;
  }

  /**
   * Immediately log a single message at the given level (bypassing buffer).
   */
  public log(
    message: string,
    level: 'info' | 'debug' | 'warn' | 'error' = 'info',
  ): void {
    const formatted = `[${this._requestId}] ${message}`;
    switch (level) {
      case 'debug':
        logger.debug(formatted);
        break;
      case 'warn':
        logger.warn(formatted);
        break;
      case 'error':
        logger.error(formatted);
        break;
      case 'info':
      default:
        logger.info(formatted);
        break;
    }
  }

  /**
   * Flush all buffered messages as a single multi-line log entry.
   */
  public flush(level: 'info' | 'debug' | 'warn' | 'error' = 'info'): void {
    const content = this._buffer.map((line) => `\t - ${line}`).join('\n');
    const message = `[${this._requestId}] ${this._handler} completed successfully:\n${content}`;

    switch (level) {
      case 'debug':
        logger.debug(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
      case 'info':
      default:
        logger.info(message);
        break;
    }
  }

  private _formatChanges(changes: ChangedProperties | null): string {
    if (!changes || Object.keys(changes).length === 0) {
      return '';
    }

    const safe = Object.fromEntries(
      Object.entries(changes).map(([key, { old, new: _new }]) => [
        key,
        {
          old: old === undefined ? null : old,
          new: _new === undefined ? null : _new,
        },
      ]),
    ) as ChangedProperties;

    return `\n\tChanged properties:\n${JSON.stringify(safe, null, 2)
      .split('\n')
      .map((line) => `\t  ${line}`)
      .join('\n')}.`;
  }

  private _extractChanges<T extends Model>(
    instance: T,
  ): ChangedProperties | null {
    const changedKeys = instance.changed();
    if (!changedKeys) return null;

    return changedKeys.reduce((acc, key) => {
      acc[key] = {
        old: instance.previous(key),
        new: instance.get(key),
      };

      return acc;
    }, {} as ChangedProperties);
  }

  private _getClassName<T>(ctor: abstract new (...args: any[]) => T): string {
    return ctor.prototype.constructor.name;
  }
}
