import type {
  CreateOptions,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { ethers } from 'ethers';
import type { UUID } from 'crypto';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../utils/getSequelizeInstance';
import {
  COMMON_EVENT_INIT_ATTRIBUTES,
  USER_METADATA_KEY,
} from '../common/constants';
import { ProjectVerificationStatus } from './GitProjectModel';
import { logRequestInfo, nameOfType } from '../utils/logRequest';
import isAccountGitProject from '../utils/isAccountGitProject';
import tryFindExpectedToExistGitProject from '../utils/tryFindExpectedToExistGitProject';
import assertTransaction from '../utils/assert';
import getProjectMetadata from '../utils/getProjectMetadata';
import validateGitProjectMetadata from '../utils/validateProjectMetadata';

export default class AccountMetadataEmittedEventModel
  extends Model<
    InferAttributes<AccountMetadataEmittedEventModel>,
    InferCreationAttributes<AccountMetadataEmittedEventModel>
  >
  implements IEventModel
{
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
          afterCreate: this._afterCreate,
        },
      },
    );
  }

  private static _afterCreate = (
    newInstance: AccountMetadataEmittedEventModel,
    options: CreateOptions<
      InferAttributes<
        AccountMetadataEmittedEventModel,
        {
          omit: never;
        }
      >
    > & { requestId: UUID },
  ): Promise<void> => {
    const { transactionHash, logIndex } = newInstance;
    const { transaction, requestId } = options as any;

    assertTransaction(transaction);

    logRequestInfo(
      `Created a new ${nameOfType(
        AccountMetadataEmittedEventModel,
      )} DB entry with ID ${transactionHash}-${logIndex}`,
      requestId,
    );

    if (isAccountGitProject(newInstance.accountId)) {
      return this._updateGitProjectMetadata(newInstance, options as any);
    }

    return Promise.resolve();
  };

  private static async _updateGitProjectMetadata(
    newInstance: AccountMetadataEmittedEventModel,
    options: CreateOptions<
      InferAttributes<
        AccountMetadataEmittedEventModel,
        {
          omit: never;
        }
      >
    > & { requestId: UUID },
  ): Promise<void> {
    const { accountId } = newInstance;
    const { transaction, requestId } = options;

    assertTransaction(transaction);

    const gitProject = await tryFindExpectedToExistGitProject(
      requestId,
      accountId,
      transaction,
    );

    const latestAccountMetadataEmittedEvent =
      (await AccountMetadataEmittedEventModel.findOne({
        where: {
          accountId,
          key: USER_METADATA_KEY,
        },
        order: [
          ['blockNumber', 'DESC'],
          ['logIndex', 'DESC'],
        ],
      })) ?? newInstance;

    const ipfsHash = ethers.toUtf8String(
      latestAccountMetadataEmittedEvent.value,
    );

    const metadata = await getProjectMetadata(ipfsHash);

    if (!metadata) {
      throw new Error(
        `Project metadata not found for Git project with account ID ${accountId} but it was expected to exist.`,
      );
    }

    validateGitProjectMetadata(gitProject, metadata);

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
        requestId,
      } as any,
    );
  }
}
