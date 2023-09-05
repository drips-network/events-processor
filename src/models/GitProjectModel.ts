import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../db/getSequelizeInstance';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import type { Forge, KnownAny, ProjectId } from '../common/types';
import { FORGES_MAP } from '../common/constants';
import getChangedProperties from '../utils/getChangedProperties';
import { assertRequestId, assertTransaction } from '../utils/assert';

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
  public declare id: ProjectId; // The `accountId` from `OwnerUpdatedRequested` event.
  public declare name: string;
  public declare forge: Forge;
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
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
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
          type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
          allowNull: false,
        },
      },
      {
        schema: getSchema(),
        tableName: 'GitProjects',
        sequelize: sequelizeInstance,
        hooks: {
          afterCreate,
          afterUpdate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: GitProjectModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      GitProjectModel,
      {
        omit: never;
      }
    >
  >,
): Promise<void> {
  const { transaction, requestId } = options as KnownAny; // `as any` to avoid TS complaining about passing in the `requestId`.
  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Created a new ${nameOfType(GitProjectModel)} DB entry for ${
      instance.name
    } repo, with ID ${instance.id}.`,
    requestId,
  );
}

async function afterUpdate(
  instance: GitProjectModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      GitProjectModel,
      {
        omit: never;
      }
    >
  >,
): Promise<void> {
  const { transaction, requestId } = options as KnownAny; // `as any` to avoid TS complaining about passing in the `requestId`.
  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Updated Git project with ID ${instance.id}: ${JSON.stringify(
      getChangedProperties(instance),
    )}.`,
    requestId,
  );
}
