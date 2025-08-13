import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';
import type {
  AccountId,
  RepoDeadlineDriverId,
  RepoDriverId,
} from '../core/types';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';

export default class AccountSeenEventModel
  extends Model<
    InferAttributes<AccountSeenEventModel>,
    InferCreationAttributes<AccountSeenEventModel>
  >
  implements IEventModel
{
  declare public accountId: RepoDeadlineDriverId;
  declare public repoAccountId: RepoDriverId;
  declare public receiverAccountId: AccountId;
  declare public refundAccountId: AccountId;
  declare public deadline: Date;

  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        accountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        repoAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        receiverAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        refundAccountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        deadline: {
          allowNull: false,
          type: DataTypes.DATE,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'account_seen_events',
        underscored: true,
        timestamps: true,
      },
    );
  }
}
