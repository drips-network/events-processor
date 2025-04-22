import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AccountId, Address, BigIntString } from '../core/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import type { IEventModel } from '../events/types';

export default class GivenEventModel
  extends Model<
    InferAttributes<GivenEventModel>,
    InferCreationAttributes<GivenEventModel>
  >
  implements IEventModel
{
  declare public accountId: AccountId; // Sender of the Give
  declare public receiver: AccountId;
  declare public erc20: Address;
  declare public amt: BigIntString;
  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receiver: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        erc20: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        amt: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'given_events',
        underscored: true,
        timestamps: false,
        indexes: [
          {
            fields: ['accountId'],
            name: `idx_given_events_accountId`,
          },
          {
            fields: ['receiver'],
            name: `idx_given_events_receiver`,
          },
          {
            fields: ['erc20'],
            name: `idx_given_events_erc20`,
          },
          {
            fields: ['transactionHash', 'logIndex'],
            name: `idx_given_events_transactionHash_logIndex`,
          },
        ],
      },
    );
  }
}
