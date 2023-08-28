import type {
  CreateOptions,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { ethers } from 'ethers';
import type { UUID } from 'crypto';
import type { IEventModel } from '../common/types';
import sequelizeInstance from '../utils/getSequelizeInstance';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import GitProjectModel, {
  Forge,
  ProjectVerificationStatus,
} from './GitProjectModel';
import { logRequestInfo } from '../utils/logRequest';
import assertTransaction from '../utils/assert';

export default class OwnerUpdateRequestedEventModel
  extends Model<
    InferAttributes<OwnerUpdateRequestedEventModel>,
    InferCreationAttributes<OwnerUpdateRequestedEventModel>
  >
  implements IEventModel
{
  public declare id: CreationOptional<number>; // Primary key

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
          afterCreate: this._createGitProject,
        },
      },
    );
  }

  private static async _createGitProject(
    newInstance: OwnerUpdateRequestedEventModel,
    options: CreateOptions<
      InferAttributes<
        OwnerUpdateRequestedEventModel,
        {
          omit: never;
        }
      >
    > & { requestId: UUID },
  ): Promise<void> {
    const { forge, name, accountId } = newInstance;
    const { transaction, requestId } = options;

    assertTransaction(transaction);

    const gitProject = await GitProjectModel.create(
      {
        accountId,
        forge: Number(forge),
        name: ethers.toUtf8String(name),
        verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
      },
      { transaction },
    );

    logRequestInfo(
      this.name,
      `created a new Git project with ID ${
        gitProject.id
      } (name ${ethers.toUtf8String(name)}, forge ${
        Forge[Number(forge)]
      } and accountId ${accountId}).`,
      requestId,
    );
  }
}
