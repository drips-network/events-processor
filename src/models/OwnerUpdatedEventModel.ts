import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import { ProjectVerificationStatus } from './GitProjectModel';
import sequelizeInstance from '../utils/getSequelizeInstance';
import { logRequestInfo, nameOfType } from '../utils/logRequest';
import tryFindExpectedToExistGitProject from '../utils/tryFindExpectedToExistGitProject';
import assertTransaction from '../utils/assert';

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
  public declare rawEvent: string;
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
          afterCreate: this._afterCreate,
        },
      },
    );
  }

  private static async _afterCreate(
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
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    const {
      owner,
      logIndex,
      transactionHash,
      accountId: gitProjectAccountId,
    } = instance;

    logRequestInfo(
      `Created a new ${nameOfType(
        OwnerUpdatedEventModel,
      )} DB entry with ID ${transactionHash}-${logIndex}`,
      requestId,
    );

    const gitProject = await tryFindExpectedToExistGitProject(
      requestId,
      gitProjectAccountId,
      transaction,
    );

    await gitProject.update(
      {
        owner,
        verificationStatus: ProjectVerificationStatus.OwnerUpdated,
      },
      { transaction, requestId } as any,
    );
  }
}
