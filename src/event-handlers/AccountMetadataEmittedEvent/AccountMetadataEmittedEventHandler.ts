import type { Transaction } from 'sequelize';
import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../../contracts/Drips';
import type { KnownAny, HandleContext } from '../../common/types';

import sequelizeInstance from '../../db/getSequelizeInstance';
import {
  logRequestDebug,
  logRequestInfo,
  nameOfType,
} from '../../utils/logRequest';
import EventHandlerBase from '../../common/EventHandlerBase';
import AccountMetadataEmittedEventModel from '../../models/AccountMetadataEmittedEventModel';
import saveEventProcessingJob from '../../queue/saveEventProcessingJob';
import { DRIPS_APP_USER_METADATA_KEY_ENCODED } from '../../common/constants';
import { isNftDriverAccountId, isRepoDiverAccountId } from '../../utils/assert';
import updateDripListMetadata from './dripList/updateDripListMetadata';
import createDbEntriesForProjectSplits from './gitProject/createDbEntriesForProjectSplits';
import updateGitProjectMetadata from './gitProject/updateGitProjectMetadata';
import IsDripList from '../../utils/isDripList';
import createDbEntriesForDripListSplits from './dripList/createDbEntriesForDripListSplits';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleContext<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const { event, id: requestId } = request;
    const { args, logIndex, blockNumber, blockTimestamp, transactionHash } =
      event;
    const [accountId, key, value] =
      args as AccountMetadataEmittedEvent.OutputTuple;

    // TODO: maybe change the key to something more app specific.
    if (key !== DRIPS_APP_USER_METADATA_KEY_ENCODED) {
      logRequestInfo(
        `Skipping processing because metadata were not emitted by the Drips App.`,
        requestId,
      );

      return;
    }

    const projectOrNftDriverId = accountId.toString();

    const logs: string[] = [];

    logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - key:         ${key}
      \r\t - value:       ${value}
      \r\t - accountId:   ${accountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const accountMetadataEmittedEventModel =
        await AccountMetadataEmittedEventModel.create(
          {
            key,
            value,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            accountId: projectOrNftDriverId,
          },
          { transaction },
        );

      logs.push(
        `Created a new ${nameOfType(
          AccountMetadataEmittedEventModel,
        )} with ID ${accountMetadataEmittedEventModel.transactionHash}-${
          accountMetadataEmittedEventModel.logIndex
        }.`,
      );

      const isLatest = await this._isLatestEvent(
        accountMetadataEmittedEventModel,
        transaction,
      );

      if (isRepoDiverAccountId(projectOrNftDriverId) && isLatest) {
        const metadata = await updateGitProjectMetadata(
          projectOrNftDriverId,
          logs,
          transaction,
          value,
        );

        await createDbEntriesForProjectSplits(
          projectOrNftDriverId,
          metadata.splits,
          logs,
          transaction,
        );
      } else if (isNftDriverAccountId(projectOrNftDriverId) && isLatest) {
        if (!(await IsDripList(projectOrNftDriverId, transaction))) {
          return;
        }

        const metadata = await updateDripListMetadata(
          projectOrNftDriverId,
          transaction,
          logs,
          value,
        );

        await createDbEntriesForDripListSplits(
          projectOrNftDriverId,
          metadata.projects,
          logs,
          transaction,
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
    instance: AccountMetadataEmittedEventModel,
    transaction: Transaction,
  ): Promise<boolean> {
    const latestEvent = await AccountMetadataEmittedEventModel.findOne({
      where: {
        accountId: instance.accountId,
        key: DRIPS_APP_USER_METADATA_KEY_ENCODED,
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
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) => {
    await saveEventProcessingJob(
      (eventLog as KnownAny).log,
      this.eventSignature,
    );
  };
}
