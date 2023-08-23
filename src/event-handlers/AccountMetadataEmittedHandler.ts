import { ethers } from 'ethers';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import { EventHandlerBase } from '../common/EventHandlerBase';
import getEventOutput from '../utils/get-event-output';
import { HandleRequest } from '../common/types';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEventModel';
import { getContractNameByAccountId } from '../utils/get-contract';
import { USER_METADATA_KEY } from '../config/constants';
import fetchIpfs from '../utils/ipfs';
import {
  GitProjectModel,
  ProjectVerificationStatus,
} from '../models/GitProjectModel';
import { repoDriverAccountMetadataParser } from '../metadata/schemas';
import sequelizeInstance from '../utils/get-sequelize-instance';
import logger from '../common/logger';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public filterSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    const { eventLog, id: requestId } = request;

    const [accountId, key, value] =
      await getEventOutput<AccountMetadataEmittedEvent.OutputTuple>(eventLog);

    await sequelizeInstance.transaction(async (transaction) => {
      const [accountMetadataEmittedEventModel, created] =
        await AccountMetadataEmittedEventModel.findOrCreate({
          transaction,
          where: {
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            transactionHash: eventLog.transactionHash,
          },
          defaults: {
            accountId: accountId.toString(),
            key,
            value,
            rawEvent: JSON.stringify(eventLog),
            blockTimestamp: (await eventLog.getBlock()).date,
          },
        });

      if (!created) {
        logger.info(
          `[${requestId}] already processed event with ID ${accountMetadataEmittedEventModel.id}. Skipping...`,
        );
        return;
      }

      await AccountMetadataEmittedEventModel.create(
        {
          key,
          value,
          accountId: accountId.toString(),
          logIndex: eventLog.index,
          blockNumber: eventLog.blockNumber,
          rawEvent: JSON.stringify(eventLog),
          transactionHash: eventLog.transactionHash,
          blockTimestamp: (await eventLog.getBlock()).date,
        },
        { transaction },
      );

      const isGitProject =
        getContractNameByAccountId(accountId) === 'repoDriver';

      if (isGitProject) {
        const gitProject = await GitProjectModel.findOne({
          where: {
            accountId: accountId.toString(),
          },
        });

        if (!gitProject) {
          throw new Error(
            `Git project with ID ${accountId} not found but it was expected to exist. Maybe the relevant event that creates the project was not processed yet. See logs for more details.`,
          );
        }

        const latestAccountMetadataEmittedEvent =
          await AccountMetadataEmittedEventModel.findOne({
            where: {
              key: USER_METADATA_KEY,
              accountId: accountId.toString(),
            },
            order: [['blockNumber', 'DESC']],
          });

        const ipfsData = await (
          await fetchIpfs(
            ethers.toUtf8String(
              latestAccountMetadataEmittedEvent
                ? latestAccountMetadataEmittedEvent.value
                : value,
            ),
          )
        ).json();

        const metadata = repoDriverAccountMetadataParser.parseAny(ipfsData);
        this._verifyMetadata(metadata, gitProject, accountId);

        await GitProjectModel.update(
          {
            color: metadata.color,
            emoji: metadata.emoji,
            url: metadata.source.url,
            description: metadata.description,
            ownerName: metadata.source.ownerName,
            verificationStatus: ProjectVerificationStatus.Completed,
          },
          {
            where: {
              accountId: accountId.toString(),
            },
            transaction,
          },
        );
      }
    });
  }

  protected onReceive: TypedListener<
    TypedContractEvent<
      AccountMetadataEmittedEvent.InputTuple,
      AccountMetadataEmittedEvent.OutputTuple,
      AccountMetadataEmittedEvent.OutputObject
    >
  > = async (_accountId, _key, _value, eventLog) =>
    this.executeHandle(new HandleRequest((eventLog as any).log));

  private _verifyMetadata(
    metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
    gitProject: GitProjectModel,
    eventAccountId: bigint,
  ) {
    const errors = [];

    const { describes, source } = metadata;
    const { url, repoName, ownerName } = source;

    if (`${ownerName}/${repoName}` !== `${gitProject.repoName}`) {
      errors.push(
        `repoName mismatch: got ${repoName}, expected ${gitProject.repoName}`,
      );
    }

    if (!url.includes(repoName)) {
      errors.push(
        `URL does not include repoName: ${gitProject.repoName} not found in ${url}`,
      );
    }

    if (describes.accountId !== eventAccountId.toString()) {
      errors.push(
        `accountId mismatch with toString: got ${
          describes.accountId
        }, expected ${eventAccountId.toString()}`,
      );
    }

    if (describes.accountId !== gitProject.accountId) {
      errors.push(
        `accountId mismatch with gitProject: got ${describes.accountId}, expected ${gitProject.accountId}`,
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `Git project with ID ${eventAccountId} has metadata that does not match the metadata emitted by the contract (${errors.join(
          '; ',
        )}).`,
      );
    }
  }
}
