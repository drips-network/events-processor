import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import type { AddressDriverId, RepoDriverId } from '../core/types';

export const PROJECT_VERIFICATION_STATUSES = [
  'claimed',
  'owner_update_requested',
  'owner_updated',
  'unclaimed',
  'pending_owner',
  'pending_metadata',
] as const;
export type ProjectVerificationStatus =
  (typeof PROJECT_VERIFICATION_STATUSES)[number];

export type ProjectName = `${string}/${string}`;

export const FORGES = ['github', 'gitlab'] as const;
export type Forge = (typeof FORGES)[number];

export default class ProjectModel extends Model<
  InferAttributes<ProjectModel>,
  InferCreationAttributes<ProjectModel>
> {
  declare public accountId: RepoDriverId;
  declare public url: string;
  declare public forge: Forge;
  declare public emoji: string | null;
  declare public color: string;
  declare public name: ProjectName;
  declare public avatarCid: string | null;
  declare public verificationStatus: ProjectVerificationStatus;
  declare public isVisible: boolean;
  declare public lastProcessedIpfsHash: string;
  declare public ownerAddress: AddressLike;
  declare public ownerAccountId: AddressDriverId;
  declare public claimedAt: Date;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          primaryKey: true,
          type: DataTypes.STRING,
        },
        name: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        verificationStatus: {
          allowNull: false,
          type: DataTypes.ENUM(...PROJECT_VERIFICATION_STATUSES),
        },
        forge: {
          allowNull: false,
          type: DataTypes.ENUM(...FORGES),
        },
        ownerAddress: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ownerAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        url: {
          allowNull: false,
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
          allowNull: false,
          type: DataTypes.STRING,
        },
        isVisible: {
          allowNull: false,
          type: DataTypes.BOOLEAN,
        },
        lastProcessedIpfsHash: {
          allowNull: false,
          type: DataTypes.TEXT,
        },
        claimedAt: {
          allowNull: false,
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
