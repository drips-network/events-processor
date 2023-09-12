import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import type { Forge, KnownAny, ProjectId } from '../common/types';
import { FORGES_MAP } from '../common/constants';
import getChangedProperties from '../utils/getChangedProperties';
import { assertRequestId, assertTransaction } from '../utils/assert';

export enum ProjectVerificationStatus {
  Claimed = 'Claimed',
  Started = 'Started',
  Unclaimed = 'Unclaimed',
  PendingOwner = 'PendingOwner',
  PendingMetadata = 'PendingMetadata',
}

export default class GitProjectModel extends Model<
  InferAttributes<GitProjectModel>,
  InferCreationAttributes<GitProjectModel>
> {
  // Properties from events.
  public declare id: ProjectId; // The `accountId` from `OwnerUpdatedRequested` event.
  public declare name: string;
  public declare forge: Forge;
  public declare ownerAddress: AddressLike | null;

  // Properties from metadata.
  public declare url: string | null;
  public declare emoji: string | null;
  public declare color: string | null;
  public declare ownerName: string | null;
  public declare description: string | null;
  public declare verificationStatus: ProjectVerificationStatus;

  public static calculateStatus(
    project: GitProjectModel,
  ): ProjectVerificationStatus {
    if (
      project.ownerAddress === null &&
      !project.url &&
      !project.emoji &&
      !project.color &&
      !project.ownerName
    ) {
      return ProjectVerificationStatus.Unclaimed;
    }

    if (
      project.ownerAddress &&
      project.url &&
      project.emoji &&
      project.color &&
      project.ownerName
    ) {
      return ProjectVerificationStatus.Claimed;
    }

    if (
      project.ownerAddress &&
      !project.url &&
      !project.emoji &&
      !project.color &&
      !project.ownerName
    ) {
      return ProjectVerificationStatus.PendingMetadata;
    }

    if (
      project.ownerAddress === null &&
      project.url &&
      project.emoji &&
      project.color &&
      project.ownerName
    ) {
      return ProjectVerificationStatus.PendingOwner;
    }

    throw new Error(
      `Unexpected Git Project verification status for project ${JSON.stringify(
        project,
        null,
        2,
      )}.`,
    );
  }

  public static initialize(sequelize: Sequelize): void {
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
        ownerAddress: {
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
        sequelize,
        schema: getSchema(),
        tableName: 'GitProjects',
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
    `Updated Git Project with ID ${instance.id}: ${JSON.stringify(
      getChangedProperties(instance),
    )}.`,
    requestId,
  );
}
