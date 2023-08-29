import type { TypedListener } from '../../contracts/common';
import { getContractInfoByFilterSignature } from '../utils/getContract';
import getResult from '../utils/getResult';
import { logRequestError, logRequestInfo } from '../utils/logRequest';
import shouldNeverHappen from '../utils/shouldNeverHappen';
import type {
  Result,
  DripsEventSignature,
  EventSignatureToEventMap,
  HandleRequest,
  DripsContractEvent,
  RepoDriverContractEvent,
  DripsContractEventSignature,
  RepoDriverContractEventSignature,
} from './types';

export default abstract class EventHandlerBase<T extends DripsEventSignature> {
  public readonly name = Object.getPrototypeOf(this).constructor.name;

  protected abstract readonly eventSignature: T;

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
  protected abstract _handle(request: HandleRequest<T>): Promise<void>;

  /**
   * Executes the handler.
   */
  public async executeHandle(request: HandleRequest<T>): Promise<Result<void>> {
    const {
      id: requestId,
      eventLog: { eventName, transactionHash, index, blockNumber },
    } = request;

    logRequestInfo(`*********** New request ***********`, requestId);
    logRequestInfo(
      `${this.name} is processing ${eventName} event with transaction hash ${transactionHash}, block number ${blockNumber} and log index ${index}.`,
      request.id,
    );

    const result = await getResult(this._handle.bind(this))(request);

    if (result.ok) {
      logRequestInfo(`Successfully processed event.`, request.id);
    } else {
      logRequestError(
        `Failed to process event: ${
          result.error?.attempts ? JSON.stringify(result.error) : result.error
        }`,
        requestId,
      );
    }

    return result;
  }

  /**
   * Registers the {@link onReceive} listener for the event.
   */
  public async registerEventListener(): Promise<void> {
    const { contract, name: contractName } =
      await getContractInfoByFilterSignature(this.eventSignature);

    switch (contractName) {
      case 'drips': {
        const eventFilter =
          contract.filters[this.eventSignature as DripsContractEventSignature];

        await contract.on(
          eventFilter,
          this.onReceive as TypedListener<DripsContractEvent>,
        );

        break;
      }
      case 'repoDriver': {
        const eventFilter =
          contract.filters[
            this.eventSignature as RepoDriverContractEventSignature
          ];

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
