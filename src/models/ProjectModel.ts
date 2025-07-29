import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { Address, AddressDriverId, RepoDriverId } from '../core/types';

export const PROJECT_VERIFICATION_STATUSES = [
  'claimed',
  'unclaimed',
  'pending_metadata',
] as const;
export type ProjectVerificationStatus =
  (typeof PROJECT_VERIFICATION_STATUSES)[number];

export type ProjectName = `${string}/${string}`;

// Note: 'orcid' IS a forge in the protocol, but it's not listed here because we index it separately as its own entity (LinkedIdentityModel).
export const FORGES = ['github', 'gitlab'] as const;
export type Forge = (typeof FORGES)[number];

export default class ProjectModel extends Model<
  InferAttributes<ProjectModel>,
  InferCreationAttributes<ProjectModel>
> {
  // Populated by `OwnerUpdated`
  declare public accountId: RepoDriverId;
  declare public ownerAddress: Address | null;
  declare public ownerAccountId: AddressDriverId | null;
  declare public claimedAt: Date | null;

  // Populated by `AccountMetadataEmitted`
  declare public url: string | null;
  declare public forge: Forge | null;
  declare public name: ProjectName | null;
  declare public emoji: string | null;
  declare public color: string | null;
  declare public avatarCid: string | null;
  declare public lastProcessedIpfsHash: string | null;

  // Common
  declare public verificationStatus: ProjectVerificationStatus;
  declare public isValid: boolean;
  declare public isVisible: boolean;
  declare public lastProcessedVersion: string;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          primaryKey: true,
          type: DataTypes.STRING,
        },
        isValid: {
          allowNull: false,
          type: DataTypes.BOOLEAN,
        },
        isVisible: {
          allowNull: false,
          type: DataTypes.BOOLEAN,
        },
        name: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        verificationStatus: {
          allowNull: false,
          type: DataTypes.ENUM(...PROJECT_VERIFICATION_STATUSES),
        },
        ownerAddress: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        ownerAccountId: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        forge: {
          allowNull: true,
          type: DataTypes.ENUM(...FORGES),
        },
        url: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        emoji: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        avatarCid: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        color: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        lastProcessedIpfsHash: {
          allowNull: true,
          type: DataTypes.TEXT,
        },
        lastProcessedVersion: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        claimedAt: {
          allowNull: true,
          type: DataTypes.DATE,
        },
        createdAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'projects',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['ownerAddress'],
            name: 'idx_projects_owner_address',
          },
          {
            fields: ['verificationStatus'],
            name: 'idx_projects_verification_status',
          },
          {
            fields: ['url'],
            name: 'idx_projects_url',
          },
        ],
      },
    );
  }
}
