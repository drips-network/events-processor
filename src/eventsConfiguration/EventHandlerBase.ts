import type { TypedListener } from '../../contracts/common';
import type { Result } from '../common/types';
import { getOriginContractByEvent } from '../utils/contractUtils';
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
   *
   * **IMPORTANT: ⚠️ do NOT call this method directly**. Use {@link executeHandle} instead.
   *
   * Usually, you'd call {@link executeHandle} from the {@link onReceive} to process the event.
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
    const { contract, name: contractName } = await getOriginContractByEvent(
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
}
