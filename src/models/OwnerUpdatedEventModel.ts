import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Sequelize,
  Transaction,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import type { IEventModel, KnownAny } from '../common/types';
import getSchema from '../utils/getSchema';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import GitProjectModel from './GitProjectModel';
import { assertRequestId, assertTransaction } from '../utils/assert';

export default class OwnerUpdatedEventModel
  extends Model<
    InferAttributes<OwnerUpdatedEventModel>,
    InferCreationAttributes<OwnerUpdatedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare owner: string;
  public declare accountId: string;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        owner: {
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
        tableName: 'OwnerUpdatedEvents',
        hooks: {
          afterCreate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: OwnerUpdatedEventModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      OwnerUpdatedEventModel,
      {
        omit: never;
      }
    >
  >,
): Promise<void> {
  const { transaction, requestId } = options as KnownAny; // `as any` to avoid TS complaining about passing in the `requestId`.
  const { owner, logIndex, accountId: projectId, transactionHash } = instance;

  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Created a new ${nameOfType(
      OwnerUpdatedEventModel,
    )} DB entry with ID ${transactionHash}-${logIndex}`,
    requestId,
  );

  if (await isLatestEvent(instance, transaction)) {
    const project = await GitProjectModel.findByPk(projectId, {
      transaction,
      lock: true,
    });

    if (!project) {
      const errorMessage = `Git Project with ID ${projectId} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`;

      logRequestDebug(errorMessage, requestId);
      throw new Error(errorMessage);
    }

    project.ownerAddress = owner;
    project.verificationStatus = GitProjectModel.calculateStatus(project);

    await project.save({ transaction, requestId } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.
  }
}

async function isLatestEvent(
  instance: OwnerUpdatedEventModel,
  transaction: Transaction,
): Promise<boolean> {
  const latestEvent = await OwnerUpdatedEventModel.findOne({
    where: {
      accountId: instance.accountId,
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
