import { isAddress } from 'ethers';
import appSettings from '../config/appSettings';
import logger from '../core/logger';
import type { AccountId, Result } from '../core/types';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { toAccountId } from '../utils/accountIdUtils';
import getResult from '../utils/getResult';
import type EventHandlerRequest from './EventHandlerRequest';
import type { EventSignature } from './types';

export default abstract class EventHandlerBase<T extends EventSignature> {
  public readonly name = Object.getPrototypeOf(this).constructor.name;

  public abstract readonly eventSignatures: T[];

  /**
   * Contains the handler's logic.
   */
  protected abstract _handle(request: EventHandlerRequest<T>): Promise<void>;

  public async createJob(request: EventHandlerRequest<T>): Promise<void> {
    await saveEventProcessingJob(request, request.event.eventSignature);
  }

  /**
   * Executes the handler.
   */
  public async executeHandle(
    request: EventHandlerRequest<T>,
  ): Promise<Result<void>> {
    const result = await getResult(this._handle.bind(this))(request);

    if (!result.ok) {
      throw result.error;
    }

    return result;
  }

  // eslint-disable-next-line no-unused-vars
  public beforeHandle(_context: EventHandlerRequest<T>): Promise<{
    accountIdsToInvalidate: AccountId[];
  }> {
    return Promise.resolve({ accountIdsToInvalidate: [] });
  }

  public async afterHandle(context: {
    args: any[];
    blockTimestamp: Date;
  }): Promise<void> {
    const { args, blockTimestamp } = context;

    // If the block is older than 15 minutes, we don't invalidate the cache to avoid unnecessary requests while indexing.
    if (new Date(blockTimestamp).getTime() < Date.now() - 15 * 60000) {
      return;
    }

    if (!appSettings.cacheInvalidationEndpoint) {
      return;
    }

    const accountIds = [] as AccountId[];

    for (const arg of args) {
      if (!isAddress(arg)) {
        try {
          const accountId = toAccountId(arg);
          if (!accountIds.includes(accountId)) {
            accountIds.push(accountId);
          }
        } catch (error: any) {
          /* empty */
        }
      }
    }

    if (accountIds.length > 0) {
      try {
        fetch(appSettings.cacheInvalidationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(accountIds),
        });

        logger.info(
          `'${
            this.name
          }' invalidated cache entries for accountIds: ${accountIds.join(
            ', ',
          )}`,
        );
      } catch (error: any) {
        logger.error(`Failed to invalidate cache: ${error.message}`);
      }
    }
  }
}
