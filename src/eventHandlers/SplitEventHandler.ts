import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import { toAccountId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { SplitEventModel } from '../models';
import { dbConnection } from '../db/database';
import type { SplitEvent } from '../../contracts/CURRENT_NETWORK/Drips';
import { toAddress } from '../utils/ethereumAddressUtils';
import { toBigIntString } from '../utils/bigintUtils';

export default class SplitEventHandler extends EventHandlerBase<'Split(uint256,uint256,address,uint128)'> {
  public eventSignatures = ['Split(uint256,uint256,address,uint128)' as const];

  protected async _handle(
    request: EventHandlerRequest<'Split(uint256,uint256,address,uint128)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawAccountId, rawReceiver, rawErc20, rawAmt] =
      args as SplitEvent.OutputTuple;

    const accountId = toAccountId(rawAccountId);
    const receiver = toAccountId(rawReceiver);
    const erc20 = toAddress(rawErc20);
    const amt = toBigIntString(rawAmt.toString());

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${request.event.eventSignature}:
      \r\t - accountId:   ${accountId}
      \r\t - receiver:    ${rawReceiver}
      \r\t - erc20:       ${rawErc20}
      \r\t - amt:         ${rawAmt}
      \r\t - logIndex:    ${logIndex}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await dbConnection.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [givenEvent, isEventCreated] = await SplitEventModel.findOrCreate({
        lock: true,
        transaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          accountId,
          receiver,
          erc20,
          amt,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });

      logManager.appendFindOrCreateLog(
        SplitEventModel,
        isEventCreated,
        `${givenEvent.transactionHash}-${givenEvent.logIndex}`,
      );

      logManager.logAllInfo();
    });
  }
}
