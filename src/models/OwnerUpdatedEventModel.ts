import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Transaction,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../db/getSequelizeInstance';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import { ProjectVerificationStatus } from './GitProjectModel';
import retryFindProject from '../utils/retryFindProject';
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

  public static initialize(): void {
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
        schema: getSchema(),
        sequelize: sequelizeInstance,
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
  const { transaction, requestId } = options as any; // `as any` to avoid TS complaining about passing in the `requestId`.
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
    const project = await retryFindProject(projectId, transaction, requestId);

    await project.update(
      {
        owner,
        verificationStatus: ProjectVerificationStatus.OwnerUpdated,
      },
      { transaction, requestId } as any, // `as any` to avoid TS complaining about passing in the `requestId`.
    );
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
