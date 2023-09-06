import type { TypedListener } from '../../contracts/common';
import { getContractDetails } from '../utils/getContract';
import getResult from '../utils/getResult';
import { logRequestInfo } from '../utils/logRequest';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import type {
  Result,
  EventSignature,
  EventSignatureToEventMap,
  HandleContext,
  DripsContractEvent,
  RepoDriverContractEvent,
  DripsEventSignature,
  RepoDriverEventSignature,
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
   * Implements the handler's logic.
   *
   * **IMPORTANT: ⚠️ do NOT call this method directly**. Use {@link executeHandle} instead.
   *
   * Usually, you'd call {@link executeHandle} from the {@link onReceive} to process the event.
   */
  protected abstract _handle(request: HandleContext<T>): Promise<void>;

  /**
   * Executes the handler.
   */
  public async executeHandle(request: HandleContext<T>): Promise<Result<void>> {
    const {
      event: { eventSignature, transactionHash, logIndex, blockNumber },
    } = request;

    logRequestInfo(
      `${this.name} is processing ${eventSignature} event with transaction hash ${transactionHash}, block number ${blockNumber} and log index ${logIndex}.`,
      request.id,
    );

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
    const { contract, name: contractName } = await getContractDetails(
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
      default: {
        shouldNeverHappen();
      }
    }
  }
}
