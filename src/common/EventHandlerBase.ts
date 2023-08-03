import type { Drips, RepoDriver } from '../../contracts';
import type { TypedListener } from '../../contracts/common';
import { getContractInfoByFilterSignature } from '../utils/get-contract';
import retryOperation from '../utils/retry-operation';
import logger from './logger';
import type {
  DripsEvent,
  HandleRequest,
  RepoDriverEvent,
  Result,
  SupportedDripsFilterSignature,
  SupportedFilter,
  SupportedFilterSignature,
  SupportedRepoDriverFilterSignature,
} from './types';

export interface IEventHandlerConstructor<T extends SupportedFilterSignature> {
  new (): EventHandlerBase<T>;
}

export abstract class EventHandlerBase<T extends SupportedFilterSignature> {
  public name = Object.getPrototypeOf(this).constructor.name;

  protected abstract filterSignature: T;

  /**
   * The callback function that will be called when the event is received.
   */
  protected abstract readonly onReceive: TypedListener<SupportedFilter[T]>;

  /**
   * Implements the handler's _logic_.
   *
   * **IMPORTANT: ⚠️ do NOT call this method directly**. Use {@link executeHandle} instead.
   *
   * Usually, you'd call {@link executeHandle} from {@link onReceive} to process the event.
   */
  protected abstract _handle<TResult = any>(
    request: HandleRequest<T>,
  ): Promise<TResult | void>;

  /**
   * Executes the handler.
   */
  public async executeHandle<TResult = any>(
    request: HandleRequest<T>,
  ): Promise<Result<TResult>> {
    const { id, eventLog } = request;

    const context = {
      requestId: id,
      handlerName: this.name,
      transactionHash: `${eventLog.transactionHash}`,
      logIndex: `${eventLog.index}`,
      blockNumber: `${eventLog.blockNumber}`,
    };
    logger.info({
      message: `${this.name} is processing`,
      context,
    });

    // TODO: retry logic will be handled by BeeQueue. When switching to BeeQueue, remember to wrap the call to _handle to `getResult`.
    const result = await retryOperation(() => this._handle(request));

    if (result.ok) {
      logger.info({
        message: `${this.name} successfully processed`,
        context,
      });
    } else {
      logger.error({
        message: `${this.name} failed with error '${result.error.message}' while processing request`,
        context,
      });
    }

    return result;
  }

  /**
   * Registers the {@link onReceive} listener for the event.
   */
  public async registerEventListener(): Promise<void> {
    const { contract, name: contractName } =
      await getContractInfoByFilterSignature(this.filterSignature);

    // We know that we are *not* going to add other contracts in the future. Switching here on all of them is fine.
    switch (contractName) {
      case 'drips': {
        const dripsContract = contract as Drips;

        const eventFilter =
          dripsContract.filters[
            this.filterSignature as SupportedDripsFilterSignature
          ];

        if (!eventFilter) {
          throw new Error(
            `Failed to register listener for filter ${this.filterSignature}: ${contractName} contract does not have a filter with the specified signature.`,
          );
        }

        await dripsContract.on(
          eventFilter,
          this.onReceive as TypedListener<DripsEvent>,
        );

        break;
      }
      case 'repoDriver': {
        const repoDriverContract = contract as RepoDriver;

        const eventFilter =
          repoDriverContract.filters[
            this.filterSignature as SupportedRepoDriverFilterSignature
          ];

        if (!eventFilter) {
          throw new Error(
            `Failed to register listener for filter ${this.filterSignature}: ${contractName} contract does not have a filter with the specified signature.`,
          );
        }

        await repoDriverContract.on(
          eventFilter,
          this.onReceive as TypedListener<RepoDriverEvent>,
        );

        break;
      }
      default: {
        throw new Error(
          `Failed to register listener for filter ${this.filterSignature}: no contract found for the specified filter.`,
        );
      }
    }
  }
}
