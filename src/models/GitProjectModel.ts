import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../utils/getSequelizeInstance';
import assertTransaction from '../utils/assert';
import { logRequestInfo, nameOfType } from '../utils/logRequest';

export enum Forge {
  GitHub = 0,
}

export enum ProjectVerificationStatus {
  Unclaimed = 'Unclaimed',
  OwnerUpdateRequested = 'OwnerUpdateRequested',
  OwnerUpdated = 'OwnerUpdated',
  Claimed = 'Claimed',
}

export default class GitProjectModel extends Model<
  InferAttributes<GitProjectModel>,
  InferCreationAttributes<GitProjectModel>
> {
  // Properties from events.
  public declare name: string;
  public declare forge: Forge;
  public declare accountId: string;
  public declare owner: AddressLike | null;

  // Properties from metadata.
  public declare url: string | null;
  public declare emoji: string | null;
  public declare color: string | null;
  public declare ownerName: string | null;
  public declare description: string | null;
  public declare verificationStatus: ProjectVerificationStatus;

  public static initialize(): void {
    this.init(
      {
        accountId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        owner: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        url: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        emoji: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        ownerName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        verificationStatus: {
          type: DataTypes.ENUM(...Object.values(ProjectVerificationStatus)),
          allowNull: false,
        },
        forge: {
          type: DataTypes.ENUM(
            ...Object.values(Forge).map((v) => v.toString()),
          ),
          allowNull: false,
        },
      },
      {
        schema: getSchema(),
        tableName: 'GitProjects',
        sequelize: sequelizeInstance,
        hooks: {
          afterCreate: this._afterCreate,
          afterUpdate: this._afterUpdate,
        },
      },
    );
  }

  private static _afterCreate = async (
    instance: GitProjectModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        GitProjectModel,
        {
          omit: never;
        }
      >
    >,
  ): Promise<void> => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    logRequestInfo(
      `Created a new ${nameOfType(GitProjectModel)} DB entry for ${
        instance.name
      } repo, with ID ${instance.accountId}.`,
      requestId,
    );
  };

  private static _afterUpdate = async (
    instance: GitProjectModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        GitProjectModel,
        {
          omit: never;
        }
      >
    >,
  ): Promise<void> => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    logRequestInfo(
      `Updated Git project with ID ${
        instance.accountId
      }. Updated fields were: ${(instance.changed() as string[]).map(
        (property) => property,
      )}.`,
      requestId,
    );
  };
}
