import { ethers } from 'ethers';
import type { OwnerUpdateRequestedEvent } from '../../contracts/RepoDriver';
import OwnerUpdateRequestedEventModel from '../models/OwnerUpdateRequestedEventModel';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import sequelizeInstance from '../db/getSequelizeInstance';
import { logRequestInfo } from '../utils/logRequest';
import type { KnownAny, HandleContext } from '../common/types';
import EventHandlerBase from '../common/EventHandlerBase';
import { FORGES_MAP } from '../common/constants';
import saveEventProcessingJob from '../common/jobQueue';

export default class OwnerUpdateRequestedEventHandler extends EventHandlerBase<'OwnerUpdateRequested(uint256,uint8,bytes)'> {
  public readonly eventSignature =
    'OwnerUpdateRequested(uint256,uint8,bytes)' as const;

  protected async _handle(
    request: HandleContext<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
  ): Promise<void> {
    const { event, id: requestId } = request;
    const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
      event;
    const [accountId, forge, name] =
      args as OwnerUpdateRequestedEvent.OutputTuple;

    logRequestInfo(
      `Event args: accountId ${accountId}, forge ${forge}, name ${ethers.toUtf8String(
        name,
      )}.`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      await OwnerUpdateRequestedEventModel.create(
        {
          name,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: accountId.toString(),
          forge: FORGES_MAP[Number(forge) as keyof typeof FORGES_MAP],
        },
        { transaction, requestId },
      );
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      OwnerUpdateRequestedEvent.InputTuple,
      OwnerUpdateRequestedEvent.OutputTuple,
      OwnerUpdateRequestedEvent.OutputObject
    >
    // TODO: change `eventLog` type.
    // Until ethers/typechain fixes the related bug, the received `eventLog` is typed as 'any' (in ALL listeners).
    // It should be of `TypedEventLog<TypedContractEvent<...>>`, which TS infers by default.
    // When fixed, we won't need to pass event.log to `executeHandle`.
  > = async (_accountId, _forge, _name, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
