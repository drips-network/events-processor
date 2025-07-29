import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { Address, AddressDriverId, RepoDriverId } from '../core/types';

export const ORCID_FORGE_ID = 2;
export const LINKED_IDENTITY_TYPES = ['orcid'] as const;
export type LinkedIdentityType = (typeof LINKED_IDENTITY_TYPES)[number];

export default class LinkedIdentityModel extends Model<
  InferAttributes<LinkedIdentityModel>,
  InferCreationAttributes<LinkedIdentityModel>
> {
  declare public accountId: RepoDriverId;
  declare public identityType: LinkedIdentityType;
  declare public ownerAddress: Address;
  declare public ownerAccountId: AddressDriverId;
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
        identityType: {
          allowNull: false,
          type: DataTypes.ENUM(...LINKED_IDENTITY_TYPES),
        },
        ownerAddress: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ownerAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        lastProcessedVersion: {
          allowNull: false,
          type: DataTypes.STRING,
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
        tableName: 'linked_identities',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['ownerAddress'],
            name: 'idx_linked_identities_owner_address',
          },
          {
            fields: ['identityType'],
            name: 'idx_linked_identities_identity_type',
          },
        ],
      },
    );
  }
}
