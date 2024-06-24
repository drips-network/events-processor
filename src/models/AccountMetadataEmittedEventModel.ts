import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';

export default class AccountMetadataEmittedEventModel
  extends Model<
    InferAttributes<AccountMetadataEmittedEventModel>,
    InferCreationAttributes<AccountMetadataEmittedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare key: string;
  public declare value: string;
  public declare accountId: string;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        key: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'AccountMetadataEmittedEvents',
        indexes: [
          {
            fields: ['accountId'],
            name: `IX_${this.tableName}_accountId`,
            unique: false,
          },
        ],
      },
    );
  }
}
