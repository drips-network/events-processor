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
  public declare receiversHash: string;
  public declare accountId: AccountId;
  public declare config: BigIntString;

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
        config: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        receiversHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'StreamReceiverSeenEvents',
        indexes: [
          {
            fields: ['accountId'],
            name: `IX_StreamReceiverSeenEvents_accountId`,
            unique: false,
          },
        ],
      },
    );
  }
}
