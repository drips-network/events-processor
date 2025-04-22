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

export default class StreamReceiverSeenEventModel
  extends Model<
    InferAttributes<StreamReceiverSeenEventModel>,
    InferCreationAttributes<StreamReceiverSeenEventModel>
  >
  implements IEventModel
{
  declare public receiversHash: string;
  declare public accountId: AccountId;
  declare public config: BigIntString;
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
        config: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receiversHash: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'stream_receiver_seen_events',
        underscored: true,
        timestamps: false,
        indexes: [
          {
            fields: ['accountId'],
            name: `idx_stream_receiver_seen_events_accountId`,
            unique: false,
          },
        ],
      },
    );
  }
}
