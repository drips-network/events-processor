import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { ethers } from 'ethers';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/get-schema';
import sequelizeInstance from '../utils/get-sequelize-instance';
import {
  COMMON_EVENT_INIT_ATTRIBUTES,
  USER_METADATA_KEY,
} from '../common/constants';
import { getContractNameByAccountId } from '../utils/get-contract';
import GitProjectModel, { ProjectVerificationStatus } from './GitProjectModel';
import fetchIpfs from '../utils/ipfs';
import { repoDriverAccountMetadataParser } from '../metadata/schemas';
import retryOperation from '../utils/retry-operation';
import { logRequestDebug, logRequestInfo } from '../utils/log-request';

export default class AccountMetadataEmittedEventModel
  extends Model<
    InferAttributes<AccountMetadataEmittedEventModel>,
    InferCreationAttributes<AccountMetadataEmittedEventModel>
  >
  implements IEventModel
{
  public declare id: CreationOptional<number>; // Primary key

  // Properties from event output.
  public declare key: string;
  public declare value: string;
  public declare accountId: string;

  // Common event log properties.
  public declare rawEvent: string;
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(): void {
    this.init(
      {
        key: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        schema: getSchema(),
        sequelize: sequelizeInstance,
        tableName: 'AccountMetadataEmittedEvents',
        hooks: {
          afterCreate: async (newInstance, options) => {
            const { accountId, value } = newInstance;
            const { transaction, requestId } = options as any;

            const isAccountGitProject =
              getContractNameByAccountId(accountId) === 'repoDriver';

            let gitProject: GitProjectModel | null;

            // We expect the Git project to exist at this point, but it's possible that the event that creates it was not processed yet.
            if (isAccountGitProject) {
              const result = await retryOperation(async () => {
                gitProject = await GitProjectModel.findOne({
                  where: {
                    accountId: accountId.toString(),
                  },
                  transaction,
                });

                if (!gitProject) {
                  logRequestDebug(
                    this.name,
                    `Git project with accountId ${accountId} was not found but it was expected to exist. Retrying because it's possible that the event that creates the project was not processed yet...`,
                    requestId,
                  );

                  throw new Error(
                    `Git project with accountId ${accountId} was not found after trying but it was expected to exist. Maybe the event that creates the project was not processed yet? Check the logs for more details.`,
                  );
                }

                return gitProject;
              });

              if (!result.ok) {
                throw result.error;
              }

              gitProject = result.value;

              const metadata = await getProjectMetadata(
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

              logRequestInfo(
                this.name,
                `updated the metadata of Git project with ID ${gitProject.id} (name: ${gitProject.name}, accountId: ${accountId}).`,
                requestId,
              );
            }
          },
        },
      },
    );
  }
}

async function getProjectMetadata(
  accountId: string,
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
