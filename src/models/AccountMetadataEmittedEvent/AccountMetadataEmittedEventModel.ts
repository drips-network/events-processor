import type {
  CreateOptions,
  InferAttributes,
  InferCreationAttributes,
  Transaction,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { UUID } from 'crypto';
import {
  COMMON_EVENT_INIT_ATTRIBUTES,
  USER_METADATA_KEY,
} from '../../common/constants';
import type { IEventModel } from '../../common/types';
import getSchema from '../../utils/getSchema';
import sequelizeInstance from '../../utils/getSequelizeInstance';
import assertTransaction from '../../utils/assert';
import { logRequestInfo, nameOfType } from '../../utils/logRequest';
import isGitProject from './isGitProject';
import updateGitProjectMetadata from './updateGitProjectMetadata';

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
          afterCreate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: AccountMetadataEmittedEventModel,
  options: CreateOptions<
    InferAttributes<
      AccountMetadataEmittedEventModel,
      {
        omit: never;
      }
    >
  > & { requestId: UUID },
): Promise<void> {
  const { transactionHash, logIndex } = instance;
  const { transaction, requestId } = options as any;

  assertTransaction(transaction);

  logRequestInfo(
    `Created a new ${nameOfType(
      AccountMetadataEmittedEventModel,
    )} DB entry with ID ${transactionHash}-${logIndex}`,
    requestId,
  );

  if (
    isGitProject(instance.accountId) &&
    (await isLatest(instance, transaction))
  ) {
    await updateGitProjectMetadata(
      requestId,
      instance.accountId,
      instance.value,
      transaction,
    );
  }

  return Promise.resolve();
}

async function isLatest(
  instance: AccountMetadataEmittedEventModel,
  transaction: Transaction,
): Promise<boolean> {
  const latestAccountMetadataEmittedEvent =
    await AccountMetadataEmittedEventModel.findOne({
      where: {
        accountId: instance.accountId,
        key: USER_METADATA_KEY,
      },
      order: [
        ['blockNumber', 'DESC'],
        ['logIndex', 'DESC'],
      ],
      transaction,
    });

  if (!latestAccountMetadataEmittedEvent) {
    return true;
  }

  if (
    latestAccountMetadataEmittedEvent.blockNumber > instance.blockNumber ||
    (latestAccountMetadataEmittedEvent.blockNumber === instance.blockNumber &&
      latestAccountMetadataEmittedEvent.logIndex >= instance.logIndex)
  ) {
    return false;
  }

  return true;
}
