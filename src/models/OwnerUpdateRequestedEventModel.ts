import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { ethers } from 'ethers';
import type { UUID } from 'crypto';
import type { IEventModel } from '../common/types';
import sequelizeInstance from '../utils/getSequelizeInstance';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import assertTransaction from '../utils/assert';
import { logRequestInfo, nameOfType } from '../utils/logRequest';
import GitProjectModel, { ProjectVerificationStatus } from './GitProjectModel';

export default class OwnerUpdateRequestedEventModel
  extends Model<
    InferAttributes<OwnerUpdateRequestedEventModel>,
    InferCreationAttributes<OwnerUpdateRequestedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare forge: number;
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
          type: DataTypes.INTEGER,
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
  > & { requestId: UUID },
): Promise<void> {
  const { transaction, requestId } = options;
  assertTransaction(transaction);

  const {
    name,
    forge,
    logIndex,
    transactionHash,
    accountId: gitProjectAccountId,
  } = instance;

  logRequestInfo(
    `Created a new ${nameOfType(
      OwnerUpdateRequestedEventModel,
    )} DB entry with ID ${transactionHash}-${logIndex}`,
    requestId,
  );

  await GitProjectModel.create(
    {
      forge: Number(forge),
      accountId: gitProjectAccountId,
      name: ethers.toUtf8String(name),
      verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
    },
    { transaction, requestId },
  );
}
