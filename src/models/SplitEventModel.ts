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

export default class SplitEventModel
  extends Model<
    InferAttributes<SplitEventModel>,
    InferCreationAttributes<SplitEventModel>
  >
  implements IEventModel
{
  public declare accountId: AccountId;
  public declare receiver: AccountId;
  public declare erc20: Address;
  public declare amt: BigIntString;

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
        receiver: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        erc20: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        amt: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'SplitEvents',
        indexes: [
          {
            fields: ['receiver'],
            name: `IX_SplitEvents_receiver`,
            unique: false,
          },
          {
            fields: ['accountId', 'receiver'],
            name: `IX_SplitEvents_accountId_receiver`,
            unique: false,
          },
        ],
      },
    );
  }
}
