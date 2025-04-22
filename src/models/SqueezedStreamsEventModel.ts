import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';
import type {
  AccountId,
  Address,
  BigIntString,
  StreamHistoryHashes,
} from '../core/types';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';

export default class SqueezedStreamsEventModel
  extends Model<
    InferAttributes<SqueezedStreamsEventModel>,
    InferCreationAttributes<SqueezedStreamsEventModel>
  >
  implements IEventModel
{
  declare public accountId: AccountId;
  declare public erc20: Address;
  declare public senderId: AccountId;
  declare public amount: BigIntString;
  declare public streamsHistoryHashes: StreamHistoryHashes;
  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  public static toStreamHistoryHashes(
    streamsHistoryHashes: string[],
  ): StreamHistoryHashes {
    return JSON.stringify(streamsHistoryHashes) as StreamHistoryHashes;
  }

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
        senderId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        amount: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        streamsHistoryHashes: {
          allowNull: false,
          type: DataTypes.JSON,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'squeezed_streams_events',
        underscored: true,
        timestamps: false,
      },
    );
  }
}
