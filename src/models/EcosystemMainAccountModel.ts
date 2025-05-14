import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AccountId, Address, NftDriverId } from '../core/types';
import getSchema from '../utils/getSchema';

export default class EcosystemMainAccountModel extends Model<
  InferAttributes<EcosystemMainAccountModel>,
  InferCreationAttributes<EcosystemMainAccountModel>
> {
  declare public accountId: NftDriverId;
  declare public isValid: boolean;
  declare public name: string | null;
  declare public creator: Address | null;
  declare public description: string | null;
  declare public ownerAddress: Address;
  declare public ownerAccountId: AccountId;
  declare public previousOwnerAddress: Address;
  declare public isVisible: boolean;
  declare public lastProcessedIpfsHash: string;
  declare public lastProcessedVersion: string;
  declare public avatar: string;
  declare public color: string;
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
        ownerAddress: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ownerAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        name: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        description: {
          allowNull: true,
          type: DataTypes.TEXT,
        },
        creator: {
          allowNull: true,
          type: DataTypes.STRING,
        },
        previousOwnerAddress: {
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
        lastProcessedVersion: {
          allowNull: false,
          type: DataTypes.BIGINT,
        },
        avatar: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        color: {
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
        tableName: 'ecosystem_main_accounts',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['ownerAddress'],
            name: `idx_ecosystem_main_accounts_owner_address`,
            where: {
              isValid: true,
            },
          },
        ],
      },
    );
  }
}
