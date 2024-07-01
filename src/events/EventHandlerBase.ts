import { isAddress } from 'ethers';
import type { TypedListener } from '../../contracts/common';
import appSettings from '../config/appSettings';
import logger from '../core/logger';
import type { AccountId, Result } from '../core/types';
import { toAccountId } from '../utils/accountIdUtils';
import { getContractInfoFromEvent } from '../utils/contractUtils';
import getResult from '../utils/getResult';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import type EventHandlerRequest from './EventHandlerRequest';
import type {
  EventSignature,
  EventSignatureToEventMap,
  DripsContractEvent,
  RepoDriverContractEvent,
  DripsEventSignature,
  RepoDriverEventSignature,
  NftDriverEventSignature,
  NftDriverContractEvent,
} from './types';

export default abstract class EventHandlerBase<T extends EventSignature> {
  public readonly name = Object.getPrototypeOf(this).constructor.name;

  public abstract readonly eventSignature: T;

  /**
   * The callback function that will be called when the event is received.
   */
  protected abstract readonly onReceive: TypedListener<
    EventSignatureToEventMap[T]
  >;

  /**
   * Contains the handler's logic.
   */
  protected abstract _handle(request: EventHandlerRequest<T>): Promise<void>;

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

  /**
   * Registers the {@link onReceive} listener for the event.
   */
  public async registerEventListener(): Promise<void> {
    const { contract, name: contractName } = await getContractInfoFromEvent(
      this.eventSignature,
    );

    switch (contractName) {
      case 'drips': {
        const eventFilter =
          contract.filters[this.eventSignature as DripsEventSignature];

        await contract.on(
          eventFilter,
          this.onReceive as TypedListener<DripsContractEvent>,
        );

        break;
      }
      case 'repoDriver': {
        const eventFilter =
          contract.filters[this.eventSignature as RepoDriverEventSignature];

        await contract.on(
          eventFilter,
          this.onReceive as TypedListener<RepoDriverContractEvent>,
        );

        break;
      }
      case 'nftDriver': {
        const eventFilter =
          contract.filters[this.eventSignature as NftDriverEventSignature];

        await contract.on(
          eventFilter,
          this.onReceive as TypedListener<NftDriverContractEvent>,
        );

        break;
      }
      default: {
        shouldNeverHappen('No contract found to register event listener on.');
      }
    }
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

    // If the block is older than 1 minute, we don't invalidate the cache to avoid unnecessary requests while indexing.
    if (new Date(blockTimestamp).getTime() < Date.now() - 60000) {
      return;
    }

    if (!appSettings.cacheInvalidationEndpoint) {
      return;
    }

    const accountIds = [] as AccountId[];

    for (const arg of args) {
      if (isAddress(arg)) {
        return;
      }

      try {
        const accountId = toAccountId(arg);

        if (!accountIds.includes(accountId)) {
          accountIds.push(accountId);
        }
      } catch (error: any) {
        /* empty */
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
