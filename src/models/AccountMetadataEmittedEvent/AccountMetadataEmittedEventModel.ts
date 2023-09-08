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
import createDbEntriesForProjectSplits from './createDbEntriesForProjectSplits';
import getProjectMetadata from './getProjectMetadata';
import isProjectId from './isProjectId';
import validateProjectMetadata from './validateProjectMetadata';
import GitProjectModel from '../GitProjectModel';
import { assertRequestId, assertTransaction } from '../../utils/assert';

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
  const { transactionHash, logIndex, accountId: projectId, value } = instance;

  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Created a new ${nameOfType(
      AccountMetadataEmittedEventModel,
    )} DB entry with ID transactionHash:${transactionHash}-logIndex:${logIndex}`,
    requestId,
  );

  if (isProjectId(projectId) && (await isLatestEvent(instance, transaction))) {
    const project = await GitProjectModel.findByPk(projectId, {
      transaction,
      lock: true,
    });

    if (!project) {
      const errorMessage = `Git project with ID ${projectId} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`;

      logRequestDebug(errorMessage, requestId);
      throw new Error(errorMessage);
    }

    const metadata = await getProjectMetadata(projectId, value);

    validateProjectMetadata(project, metadata);

    const { color, emoji, source, splits, description } = metadata;

    project.color = color;
    project.emoji = emoji;
    project.url = source.url;
    project.ownerName = source.ownerName;
    project.description = description ?? null;
    project.verificationStatus = GitProjectModel.calculateStatus(project);

    await project.save({ transaction, requestId } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.

    await createDbEntriesForProjectSplits(
      project.id,
      splits,
      requestId,
      transaction,
    );
  }

  return Promise.resolve();
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
