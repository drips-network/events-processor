import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';
import type { AccountId } from '../core/types';

export default class AccountMetadataEmittedEventModel
  extends Model<
    InferAttributes<AccountMetadataEmittedEventModel>,
    InferCreationAttributes<AccountMetadataEmittedEventModel>
  >
  implements IEventModel
{
  declare public key: string;
  declare public value: string;
  declare public accountId: AccountId;
  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        key: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        value: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        accountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'account_metadata_emitted_events',
        indexes: [
          {
            fields: ['accountId'],
            name: 'idx_account_metadata_emitted_events_accountId',
          },
        ],
      },
    );
  }
}
