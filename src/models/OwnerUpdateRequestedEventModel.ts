import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { ethers } from 'ethers';
import type { Forge, IEventModel } from '../common/types';
import sequelizeInstance from '../db/getSequelizeInstance';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES, FORGES_MAP } from '../common/constants';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import GitProjectModel, { ProjectVerificationStatus } from './GitProjectModel';
import {
  assertProjectId,
  assertRequestId,
  assertTransaction,
} from '../utils/assert';

export default class OwnerUpdateRequestedEventModel
  extends Model<
    InferAttributes<OwnerUpdateRequestedEventModel>,
    InferCreationAttributes<OwnerUpdateRequestedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare forge: Forge;
  public declare name: string;
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
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        forge: {
          type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        schema: getSchema(),
        sequelize: sequelizeInstance,
        tableName: 'OwnerUpdateRequestedEvents',
        hooks: {
          afterCreate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: OwnerUpdateRequestedEventModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      OwnerUpdateRequestedEventModel,
      {
        omit: never;
      }
    >
  >,
): Promise<void> {
  const { transaction, requestId } = options as any; // `as any` to avoid TS complaining about passing in the `requestId`.
  const { name, forge, logIndex, accountId, transactionHash } = instance;

  assertTransaction(transaction);
  assertRequestId(requestId);
  assertProjectId(accountId);

  logRequestDebug(
    `Created a new ${nameOfType(
      OwnerUpdateRequestedEventModel,
    )} DB entry with ID ${transactionHash}-${logIndex}`,
    requestId,
  );

  await GitProjectModel.create(
    {
      forge,
      id: accountId,
      name: ethers.toUtf8String(name),
      verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
    },
    { transaction, requestId },
  );
}
