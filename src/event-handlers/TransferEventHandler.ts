import type { Transaction } from 'sequelize';
import type { TypedListener, TypedContractEvent } from '../../contracts/common';
import type { TransferEvent } from '../../contracts/NftDriver';
import EventHandlerBase from '../common/EventHandlerBase';
import type { HandleContext, KnownAny } from '../common/types';
import sequelizeInstance from '../db/getSequelizeInstance';
import { saveEventProcessingJob } from '../queue';
import { assertNftDriverAccountId } from '../utils/assert';
import {
  logRequestDebug,
  logRequestInfo,
  nameOfType,
} from '../utils/logRequest';
import TransferEventModel from '../models/TransferEventModel';
import IsDripList from '../utils/isDripList';
import DripListModel from '../models/DripListModel';

export default class TransferEventHandler extends EventHandlerBase<'Transfer(address,address,uint256)'> {
  public eventSignature = 'Transfer(address,address,uint256)' as const;

  protected async _handle(
    request: HandleContext<'Transfer(address,address,uint256)'>,
  ): Promise<void> {
    const { event, id: requestId } = request;
    const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
      event;
    const [from, to, tokenId] = args as TransferEvent.OutputTuple;

    const logs: string[] = [];

    logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - from:        ${from}
      \r\t - to:          ${to}
      \r\t - tokenId:     ${tokenId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    const id = tokenId.toString();
    assertNftDriverAccountId(id);

    await sequelizeInstance.transaction(async (transaction) => {
      const transferEventModel = await TransferEventModel.create(
        {
          tokenId: id,
          to,
          from,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction,
          requestId,
        },
      );

      logs.push(
        `Created a new ${nameOfType(TransferEventModel)} with ID ${
          transferEventModel.transactionHash
        }-${transferEventModel.logIndex}.`,
      );

      if (!(await IsDripList(id, transaction))) {
        return;
      }

      const [dripList, created] = await DripListModel.findOrCreate({
        transaction,
        lock: true,
        where: {
          id,
        },
        defaults: {
          id,
          name: null,
          isPublic: false,
          ownerAddress: to,
          projectsJson: null,
        },
      });

      logs.push(
        `${
          created
            ? `Created a new 📝 ${nameOfType(DripListModel)} with ID ${
                dripList.id
              }.`
            : `Drip List with ID ${dripList.id} already exists. Probably, it was created by another event. Skipping creation.`
        }`,
      );

      if (await this._isLatestEvent(transferEventModel, transaction)) {
        const previousOwnerAddress = dripList.ownerAddress;
        dripList.ownerAddress = to;

        await dripList.save({ transaction });

        logs.push(
          `${this.eventSignature} was the latest event for project ${dripList.id}. The Drip List owner was updated from ${previousOwnerAddress} to ${dripList.ownerAddress}.`,
        );
      }

      logRequestDebug(
        `Completed successfully. The following changes occurred:\n\t - ${logs.join(
          '\n\t - ',
        )}`,
        requestId,
      );
    });
  }

  private async _isLatestEvent(
    instance: TransferEventModel,
    transaction: Transaction,
  ): Promise<boolean> {
    const latestEvent = await TransferEventModel.findOne({
      where: {
        tokenId: instance.tokenId,
      },
      order: [
        ['blockNumber', 'DESC'],
        ['logIndex', 'DESC'],
      ],
      transaction,
      lock: true,
    });

    if (!latestEvent) {
      return true;
    }

    if (
      latestEvent.blockNumber > instance.blockNumber ||
      (latestEvent.blockNumber === instance.blockNumber &&
        latestEvent.logIndex > instance.logIndex)
    ) {
      return false;
    }

    return true;
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      TransferEvent.InputTuple,
      TransferEvent.OutputTuple,
      TransferEvent.OutputObject
    >
  > = async (_from, _to, _tokenId, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
