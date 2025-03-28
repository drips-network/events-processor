import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import type { AccountId, Forge, ProjectId } from '../core/types';
import { FORGES_MAP } from '../core/constants';

export enum ProjectVerificationStatus {
  Claimed = 'Claimed',
  OwnerUpdateRequested = 'OwnerUpdateRequested',
  OwnerUpdated = 'OwnerUpdated',
  Unclaimed = 'Unclaimed',
  PendingOwner = 'PendingOwner',
  PendingMetadata = 'PendingMetadata',
}

export default class GitProjectModel extends Model<
  InferAttributes<GitProjectModel>,
  InferCreationAttributes<GitProjectModel>
> {
  public declare id: ProjectId; // The `accountId` from `OwnerUpdatedRequested` event.
  public declare isValid: boolean;
  public declare name: string | null;
  public declare forge: Forge | null;
  public declare ownerAddress: AddressLike | null;
  public declare ownerAccountId: AccountId | null;

  public declare url: string | null;
  public declare emoji: string | null;
  public declare avatarCid: string | null;
  public declare color: string | null;
  public declare description: string | null;
  public declare verificationStatus: ProjectVerificationStatus;
  public declare isVisible: boolean;
  public declare lastProcessedIpfsHash: string | null;

  public declare claimedAt: Date | null;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        isValid: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            isValidName(value: string) {
              if (!value) {
                throw new Error('Project name is required.');
              }

              const components = value?.split('/');

              if (components.length !== 2) {
                throw new Error(`Invalid project name: '${value}'.`);
              }

              const ownerName = components[0];
              const repoName = components[1];

              const validProjectNameRegex: RegExp = /^[\w.-]+$/;

              if (
                !validProjectNameRegex.test(ownerName) ||
                !validProjectNameRegex.test(repoName)
              ) {
                throw new Error(`Invalid project name: '${value}'.`);
              }
            },
          },
        },
        verificationStatus: {
          type: DataTypes.ENUM(...Object.values(ProjectVerificationStatus)),
          allowNull: false,
        },
        claimedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        forge: {
          type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
          allowNull: true,
        },
        ownerAddress: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        ownerAccountId: {
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
        avatarCid: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        isVisible: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        lastProcessedIpfsHash: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'GitProjects',
        indexes: [
          {
            fields: ['ownerAddress'],
            name: `IX_GitProjects_ownerAddress`,
            unique: false,
            where: {
              isValid: true,
            },
          },
          {
            fields: ['verificationStatus'],
            name: `IX_GitProjects_verificationStatus`,
            where: {
              isValid: true,
            },
            unique: false,
          },
          {
            fields: ['url'],
            name: `IX_GitProjects_url`,
            where: {
              isValid: true,
            },
            unique: false,
          },
        ],
      },
    );
  }
}
