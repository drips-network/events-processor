import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { UUID } from 'crypto';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../utils/getSequelizeInstance';
import assertTransaction from '../utils/assert';
import { logRequestInfo, nameOfType } from '../utils/logRequest';
import retryFindGitProject from '../utils/retryFindGitProject';
import { ProjectVerificationStatus } from './GitProjectModel';

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
  > & { requestId: UUID },
): Promise<void> {
  const { transaction, requestId } = options;
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

  const gitProject = await retryFindGitProject(
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
