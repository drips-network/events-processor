import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../common/types';
import getSchema from '../utils/get-schema';
import sequelizeInstance from '../utils/get-sequelize-instance';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../common/constants';
import GitProjectModel, { ProjectVerificationStatus } from './GitProjectModel';
import retryOperation from '../utils/retry-operation';
import { logRequestDebug, logRequestInfo } from '../utils/log-request';

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
          afterCreate: async (newInstance, options) => {
            const { accountId, owner } = newInstance;
            const { transaction, requestId } = options as any;

            let gitProject: GitProjectModel | null;

            // We expect the Git project to exist at this point, but it's possible that the event that creates it was not processed yet.
            const result = await retryOperation(async () => {
              gitProject = await GitProjectModel.findOne({
                where: {
                  accountId: accountId.toString(),
                },
                transaction,
              });

              if (!gitProject) {
                logRequestDebug(
                  this.name,
                  `Git project with accountId ${accountId} was not found but it was expected to exist. Retrying because it's possible that the event that creates the project was not processed yet...`,
                  requestId,
                );

                throw new Error(
                  `Git project with accountId ${accountId} was not found after trying but it was expected to exist. Maybe the event that creates the project was not processed yet? Check the logs for more details.`,
                );
              }

              return gitProject;
            });

            if (!result.ok) {
              throw result.error;
            }

            gitProject = result.value;

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
          },
        },
      },
    );
  }
}
