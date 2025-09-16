import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { Address, AddressDriverId, RepoDriverId } from '../core/types';

/**
 * ForgeId for ORCID in account IDs. Value is 4 (not 2 like Forge.ORCID enum)
 * because forgeId encodes both forge type and name length: 0,1=GitHub, 2,3=GitLab, 4=ORCID.
 */
export const ORCID_FORGE_ID = 4;
export const LINKED_IDENTITY_TYPES = ['orcid'] as const;
export type LinkedIdentityType = (typeof LINKED_IDENTITY_TYPES)[number];

export default class LinkedIdentityModel extends Model<
  InferAttributes<LinkedIdentityModel>,
  InferCreationAttributes<LinkedIdentityModel>
> {
  public declare accountId: RepoDriverId;
  public declare identityType: LinkedIdentityType;
  public declare ownerAddress: Address | null;
  public declare ownerAccountId: AddressDriverId | null;
  public declare isLinked: boolean;
  public declare lastProcessedVersion: string;
  public declare createdAt: CreationOptional<Date>;
  public declare updatedAt: CreationOptional<Date>;

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
          allowNull: true,
          type: DataTypes.STRING,
        },
        ownerAccountId: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        isLinked: {
          allowNull: false,
          type: DataTypes.BOOLEAN,
          defaultValue: false,
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
