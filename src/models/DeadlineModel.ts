import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type {
  AccountId,
  RepoDeadlineDriverId,
  RepoDriverId,
} from '../core/types';
import { type AccountType, ACCOUNT_TYPES } from '../core/splitRules';

export default class DeadlineModel extends Model<
  InferAttributes<DeadlineModel>,
  InferCreationAttributes<DeadlineModel>
> {
  declare public accountId: RepoDeadlineDriverId;

  declare public receivingAccountId: AccountId;
  declare public receivingAccountType: AccountType;

  declare public claimableProjectId: RepoDriverId;

  declare public deadline: Date;

  declare public refundAccountId: AccountId;
  declare public refundAccountType: AccountType;

  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          primaryKey: true,
          type: DataTypes.STRING,
        },
        receivingAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receivingAccountType: {
          allowNull: false,
          type: DataTypes.ENUM(...ACCOUNT_TYPES),
        },
        claimableProjectId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        deadline: {
          allowNull: false,
          type: DataTypes.DATE,
        },
        refundAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        refundAccountType: {
          allowNull: false,
          type: DataTypes.ENUM(...ACCOUNT_TYPES),
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
        tableName: 'deadlines',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['receivingAccountId'],
            name: 'idx_deadlines_receiving_account_id',
          },
          {
            fields: ['claimableProjectId'],
            name: 'idx_deadlines_claimable_project_id',
          },
          {
            fields: ['refundAccountId'],
            name: 'idx_deadlines_refund_account_id',
          },
          {
            fields: ['deadline'],
            name: 'idx_deadlines_deadline',
          },
        ],
      },
    );
  }
}
