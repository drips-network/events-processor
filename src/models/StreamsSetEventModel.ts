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
  public declare accountId: AccountId;
  public declare erc20: string;
  public declare receiversHash: string;
  public declare streamsHistoryHash: string;
  public declare balance: BigIntString;
  public declare maxEnd: BigIntString;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        erc20: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        receiversHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        streamsHistoryHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        balance: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        maxEnd: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'StreamsSetEvents',
      },
    );
  }
}
