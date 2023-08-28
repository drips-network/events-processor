import type {
  CreateOptions,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { UUID } from 'crypto';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import { ProjectVerificationStatus } from './GitProjectModel';
import sequelizeInstance from '../utils/getSequelizeInstance';
import { logRequestInfo } from '../utils/logRequest';
import tryFindExpectedToExistGitProject from '../utils/tryFindExpectedToExistGitProject';
import assertTransaction from '../utils/assert';

export default class OwnerUpdatedEventModel
  extends Model<
    InferAttributes<OwnerUpdatedEventModel>,
    InferCreationAttributes<OwnerUpdatedEventModel>
  >
  implements IEventModel
{
  public declare id: CreationOptional<number>; // Primary key

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
          afterCreate: this._updateGitProjectOwner,
        },
      },
    );
  }

  private static _updateGitProjectOwner = async (
    newInstance: OwnerUpdatedEventModel,
    options: CreateOptions<
      InferAttributes<
        OwnerUpdatedEventModel,
        {
          omit: never;
        }
      >
    > & { requestId: UUID },
  ): Promise<void> => {
    const { accountId, owner } = newInstance;
    const { transaction, requestId } = options;

    assertTransaction(transaction);

    const gitProject = await tryFindExpectedToExistGitProject(
      this.name,
      requestId,
      accountId,
      transaction,
    );

    await gitProject.update(
      {
        owner,
        verificationStatus: ProjectVerificationStatus.OwnerUpdated,
      },
      { transaction },
    );

    logRequestInfo(
      this.name,
      `updated the owner of Git project with ID ${gitProject.id} (name: ${gitProject.name}, accountId: ${accountId}) to ${owner}.`,
      requestId,
    );
  };
}
