import type {
  CreateOptions,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
  Transaction,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import {
  COMMON_EVENT_INIT_ATTRIBUTES,
  USER_METADATA_KEY,
} from '../../common/constants';
import type { IEventModel, KnownAny } from '../../common/types';
import getSchema from '../../utils/getSchema';
import { logRequestDebug, nameOfType } from '../../utils/logRequest';
import isProjectId, {
  assertRequestId,
  assertTransaction,
  isNftDriverAccountId,
} from '../../utils/assert';
import handleGitProjectMetadata from './gitProject/handleGitProjectMetadata';

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
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
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
        sequelize,
        schema: getSchema(),
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
  >,
): Promise<void> {
  const { transaction, requestId } = options as KnownAny; // `as any` to avoid TS complaining about passing in the `requestId`.
  const { transactionHash, logIndex, accountId, value } = instance;

  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Created a new ${nameOfType(
      AccountMetadataEmittedEventModel,
    )} DB entry with ID transactionHash:${transactionHash}-logIndex:${logIndex}`,
    requestId,
  );

  const isLatest = await isLatestEvent(instance, transaction);

  if (isProjectId(accountId) && isLatest) {
    await handleGitProjectMetadata(accountId, transaction, requestId, value);
  } else if (isNftDriverAccountId(accountId)) {
    logRequestDebug(`🌄🌄🌄🌄🌄🌄🌄🌄`, requestId);
  }
}

async function isLatestEvent(
  instance: AccountMetadataEmittedEventModel,
  transaction: Transaction,
): Promise<boolean> {
  const latestEvent = await AccountMetadataEmittedEventModel.findOne({
    where: {
      accountId: instance.accountId,
      key: USER_METADATA_KEY,
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
