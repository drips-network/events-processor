import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AccountId } from '../core/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import type { IEventModel } from '../events/types';

export default class SplitsSetEventModel
  extends Model<
    InferAttributes<SplitsSetEventModel>,
    InferCreationAttributes<SplitsSetEventModel>
  >
  implements IEventModel
{
  declare public accountId: AccountId;
  declare public receiversHash: string;
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
        receiversHash: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        timestamps: true,
        underscored: true,
        schema: getSchema(),
        tableName: 'splits_set_events',
      },
    );
  }
}
