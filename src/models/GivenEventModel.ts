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
        tableName: 'GivenEvents',
        indexes: [
          {
            fields: ['accountId'],
            name: `IX_GivenEvents_accountId`,
            unique: false,
          },
          {
            fields: ['receiver'],
            name: `IX_GivenEvents_receiver`,
            unique: false,
          },
          {
            fields: ['erc20'],
            name: `IX_GivenEvents_erc20`,
            unique: false,
          },
          {
            fields: ['transactionHash', 'logIndex'],
            name: `IX_GivenEvents_transactionHash_logIndex`,
            unique: false,
          },
        ],
      },
    );
  }
}
