import { ethers } from 'ethers';
import type {
  TypedContractEvent,
  TypedListener,
} from '../../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../../contracts/Drips';
import type { KnownAny, HandleRequest } from '../../common/types';

import sequelizeInstance from '../../db/getSequelizeInstance';
import EventHandlerBase from '../../common/EventHandlerBase';
import AccountMetadataEmittedEventModel from '../../models/AccountMetadataEmittedEventModel';
import saveEventProcessingJob from '../../queue/saveEventProcessingJob';
import { DRIPS_APP_USER_METADATA_KEY } from '../../common/constants';
import updateDripListMetadata from './dripList/updateDripListMetadata';
import createDbEntriesForProjectSplits from './gitProject/createDbEntriesForProjectSplits';
import updateGitProjectMetadata from './gitProject/updateGitProjectMetadata';
import IsDripList from '../../utils/dripListUtils';
import createDbEntriesForDripListSplits from './dripList/createDbEntriesForDripListSplits';
import LogManager from '../../common/LogManager';
import {
  isNftDriverId,
  isRepoDiverId,
  toAccountId,
} from '../../utils/accountIdUtils';
import { isLatestEvent } from '../../utils/eventUtils';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public readonly eventSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const {
      id: requestId,
      event: { args, logIndex, blockNumber, blockTimestamp, transactionHash },
    } = request;

    const [accountId, key, value] =
      args as AccountMetadataEmittedEvent.OutputTuple;

    if (key !== DRIPS_APP_USER_METADATA_KEY) {
      LogManager.logRequestInfo(
        `Skipping ${this.eventSignature} event because the metadata were not emitted by the Drips App.`,
        requestId,
      );
      return;
    }

    const typedAccountId = toAccountId(accountId);

    LogManager.logRequestInfo(
      `📥 ${this.name} is processing the following ${this.eventSignature}:
      \r\t - key:         ${key}
      \r\t - value:       ${value} (decoded: ${ethers.toUtf8String(value)})
      \r\t - accountId:   ${typedAccountId},
      \r\t - logIndex:    ${logIndex}
      \r\t - blockNumber: ${blockNumber}
      \r\t - tx hash:     ${transactionHash}`,
      requestId,
    );

    await sequelizeInstance.transaction(async (transaction) => {
      const logManager = new LogManager(requestId);

      const [accountMetadataEmittedEventModel, isEventCreated] =
        await AccountMetadataEmittedEventModel.findOrCreate({
          lock: true,
          transaction,
          where: {
            logIndex,
            transactionHash,
          },
          defaults: {
            key,
            value,
            logIndex,
            blockNumber,
            blockTimestamp,
            transactionHash,
            accountId: typedAccountId,
          },
        });

      logManager.appendFindOrCreateLog(
        AccountMetadataEmittedEventModel,
        isEventCreated,
        `${accountMetadataEmittedEventModel.transactionHash}-${accountMetadataEmittedEventModel.logIndex}`,
      );

      const isLatest = await isLatestEvent(
        accountMetadataEmittedEventModel,
        AccountMetadataEmittedEventModel,
        {
          transactionHash,
          logIndex,
        },
        transaction,
      );

      // `RepoDriver` account + Drips App metadata key => Git Project
      if (isRepoDiverId(typedAccountId) && isLatest) {
        logManager.appendIsLatestEventLog();

        const metadata = await updateGitProjectMetadata(
          typedAccountId,
          logManager,
          transaction,
          value,
        );

        await createDbEntriesForProjectSplits(
          typedAccountId,
          metadata.splits,
          logManager,
          transaction,
        );
      }
      // `NftDriver` account + Drips App metadata key => Drip List
      else if (isNftDriverId(typedAccountId) && isLatest) {
        logManager.appendIsLatestEventLog();

        if (!(await IsDripList(typedAccountId, transaction))) {
          return;
        }

        const metadata = await updateDripListMetadata(
          typedAccountId,
          transaction,
          logManager,
          value,
        );

        await createDbEntriesForDripListSplits(
          typedAccountId,
          metadata.projects,
          logManager,
          transaction,
        );
      }

      logManager.logDebug();
    });
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
