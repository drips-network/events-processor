import { ethers } from 'ethers';
import type { TypedContractEvent, TypedListener } from '../../contracts/common';
import type { AccountMetadataEmittedEvent } from '../../contracts/Drips';
import { EventHandlerBase } from '../common/EventHandlerBase';
import parseEventOutput from '../utils/parse-event-output';
import { HandleRequest } from '../common/types';
import AccountMetadataEmittedEventModel from '../models/AccountMetadataEmittedEventModel';
import { getContractNameByAccountId } from '../utils/get-contract';
import { USER_METADATA_KEY } from '../common/constants';
import fetchIpfs from '../utils/ipfs';

import { repoDriverAccountMetadataParser } from '../metadata/schemas';
import sequelizeInstance from '../utils/get-sequelize-instance';
import logger from '../common/logger';
import shouldNeverHappen from '../utils/throw';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../models/GitProjectModel';

export default class AccountMetadataEmittedEventHandler extends EventHandlerBase<'AccountMetadataEmitted(uint256,bytes32,bytes)'> {
  public filterSignature =
    'AccountMetadataEmitted(uint256,bytes32,bytes)' as const;

  protected async _handle(
    request: HandleRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
  ): Promise<void> {
    await sequelizeInstance.transaction(async (transaction) => {
      const { eventLog, id: requestId } = request;

      const [accountId, key, value] =
        await parseEventOutput<AccountMetadataEmittedEvent.OutputTuple>(
          eventLog,
        );

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
            logIndex: eventLog.index,
            blockNumber: eventLog.blockNumber,
            blockTimestamp:
              (await eventLog.getBlock()).date ?? shouldNeverHappen(),
            transactionHash: eventLog.transactionHash,
          },
        });

      if (!created) {
        logger.info(
          `[${requestId}] already processed event with ID ${accountMetadataEmittedEventModel.id}. Skipping...`,
        );
      }

      const isAccountGitProject =
        getContractNameByAccountId(accountId) === 'repoDriver';
      if (isAccountGitProject) {
        const gitProject = await GitProjectModel.findOne({
          where: {
            accountId: accountId.toString(),
          },
          transaction,
        });

        if (!gitProject) {
          throw new Error(
            `Git project with ID ${accountId} not found but it was expected to exist. Maybe the relevant event that creates the project was not processed yet. See logs for more details.`,
          );
        }
        const metadata = await this._getProjectIpfsMetadata(
          accountId,
          value,
          gitProject,
        );

        await gitProject.update(
          {
            color: metadata.color,
            emoji: metadata.emoji,
            url: metadata.source.url,
            description: metadata.description,
            ownerName: metadata.source.ownerName,
            verificationStatus: ProjectVerificationStatus.Claimed,
          },
          {
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

  private async _getProjectIpfsMetadata(
    accountId: bigint,
    value: string,
    gitProject: GitProjectModel,
  ) {
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

    const errors = [];

    const { describes, source } = metadata;
    const { url, repoName, ownerName } = source;

    if (`${ownerName}/${repoName}` !== `${gitProject.name}`) {
      errors.push(
        `repoName mismatch: got ${repoName}, expected ${gitProject.name}`,
      );
    }

    if (!url.includes(repoName)) {
      errors.push(
        `URL does not include repoName: ${gitProject.name} not found in ${url}`,
      );
    }

    if (describes.accountId !== accountId.toString()) {
      errors.push(
        `accountId mismatch with toString: got ${
          describes.accountId
        }, expected ${accountId.toString()}`,
      );
    }

    if (describes.accountId !== gitProject.accountId) {
      errors.push(
        `accountId mismatch with gitProject: got ${describes.accountId}, expected ${gitProject.accountId}`,
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `Git project with ID ${accountId} has metadata that does not match the metadata emitted by the contract (${errors.join(
          '; ',
        )}).`,
      );
    }

    return metadata;
  }
}
