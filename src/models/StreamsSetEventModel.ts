import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../events/types';
import type { AccountId, BigIntString } from '../core/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';

export default class StreamsSetEventModel
  extends Model<
    InferAttributes<StreamsSetEventModel>,
    InferCreationAttributes<StreamsSetEventModel>
  >
  implements IEventModel
{
  declare public accountId: AccountId;
  declare public erc20: string;
  declare public receiversHash: string;
  declare public streamsHistoryHash: string;
  declare public balance: BigIntString;
  declare public maxEnd: BigIntString;
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
        erc20: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receiversHash: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        streamsHistoryHash: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        balance: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        maxEnd: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'streams_set_events',
        underscored: true,
        timestamps: true,
        indexes: [
          {
            fields: ['receiversHash'],
            name: `idx_streams_set_events_receiversHash`,
            unique: false,
          },
          {
            fields: ['accountId'],
            name: `idx_streams_set_events_accountId`,
            unique: false,
          },
        ],
      },
    );
  }
}
