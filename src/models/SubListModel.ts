import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { ImmutableSplitsDriverId, AccountId } from '../core/types';
import getSchema from '../utils/getSchema';
import type { AccountType } from '../core/splitRules';

export default class SubListModel extends Model<
  InferAttributes<SubListModel>,
  InferCreationAttributes<SubListModel>
> {
  declare public accountId: ImmutableSplitsDriverId;
  declare public parentId: AccountId;
  declare public parentAccountType: AccountType;
  declare public rootId: AccountId;
  declare public rootAccountType: AccountType;
  declare public lastProcessedIpfsHash: string;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          primaryKey: false,
          type: DataTypes.STRING,
        },
        parentId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        parentAccountType: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        rootId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        rootAccountType: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        lastProcessedIpfsHash: {
          type: DataTypes.TEXT,
          allowNull: false,
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
        tableName: 'sub_lists',
        timestamps: true,
        indexes: [
          {
            fields: ['accountId'],
            name: 'idx_sub_lists_account_id',
          },
          {
            fields: ['parentId'],
            name: 'idx_sub_lists_parent_id',
          },
          {
            fields: ['rootId'],
            name: 'idx_sub_lists_root_id',
          },
        ],
      },
    );
  }
}
