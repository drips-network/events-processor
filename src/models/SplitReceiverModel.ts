import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { AccountId } from '../core/types';
import {
  type RelationshipType,
  type AccountType,
  ACCOUNT_TYPES,
  RELATIONSHIP_TYPES,
} from '../core/splitRules';

export default class SplitReceiverModel extends Model<
  InferAttributes<SplitReceiverModel>,
  InferCreationAttributes<SplitReceiverModel>
> {
  declare public id: CreationOptional<number>;
  declare public receiverAccountId: AccountId;
  declare public receiverAccountType: AccountType;
  declare public senderAccountId: AccountId;
  declare public senderAccountType: AccountType;
  declare public relationshipType: RelationshipType;
  declare public weight: number;
  declare public blockTimestamp: Date;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          primaryKey: true,
          autoIncrement: true,
          type: DataTypes.INTEGER,
        },
        receiverAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receiverAccountType: {
          allowNull: false,
          type: DataTypes.ENUM(...ACCOUNT_TYPES),
        },
        senderAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        senderAccountType: {
          allowNull: false,
          type: DataTypes.ENUM(...ACCOUNT_TYPES),
        },
        relationshipType: {
          allowNull: false,
          type: DataTypes.ENUM(...RELATIONSHIP_TYPES),
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        blockTimestamp: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'split_receivers',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['receiverAccountId', 'senderAccountId'],
            name: 'idx_split_receivers_receiver_sender',
          },
          {
            fields: ['senderAccountId', 'receiverAccountId'],
            name: 'idx_split_receivers_sender_receiver',
          },
        ],
      },
    );
  }
}
