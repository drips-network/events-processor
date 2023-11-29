import EventHandlerBase from '../events/EventHandlerBase';
import LogManager from '../core/LogManager';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { KnownAny } from '../core/types';
import { toAccountId } from '../utils/accountIdUtils';
import type EventHandlerRequest from '../events/EventHandlerRequest';
import { GivenEventModel, TransferEventModel } from '../models';
import saveEventProcessingJob from '../queue/saveEventProcessingJob';
import { dbConnection } from '../db/database';
import type { GivenEvent } from '../../contracts/Drips';
import { toAddress } from '../utils/ethereumAddressUtils';
import { toBigIntString } from '../utils/bigintUtils';

export default class GivenEventHandler extends EventHandlerBase<'Given(uint256,uint256,address,uint128)'> {
  public eventSignature = 'Given(uint256,uint256,address,uint128)' as const;

  protected async _handle(
    request: EventHandlerRequest<typeof this.eventSignature>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [rawAccountId, rawReceiver, rawErc20, rawAmt] =
      args as GivenEvent.OutputTuple;

    const accountId = toAccountId(rawAccountId);
    const receiver = toAccountId(rawReceiver);
    const erc20 = toAddress(rawErc20);
    const amt = toBigIntString(rawAmt.toString());

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
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

      const [givenEvent, isEventCreated] = await GivenEventModel.findOrCreate({
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
        TransferEventModel,
        isEventCreated,
        `${givenEvent.transactionHash}-${givenEvent.logIndex}`,
      );

      logManager.logAllInfo();
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      GivenEvent.InputTuple,
      GivenEvent.OutputTuple,
      GivenEvent.OutputObject
    >
  > = async (_accId, _receiver, _erc20, _amt, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
