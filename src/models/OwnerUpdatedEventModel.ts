import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import type { RepoDriverId } from '../core/types';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';

export default class OwnerUpdatedEventModel
  extends Model<
    InferAttributes<OwnerUpdatedEventModel>,
    InferCreationAttributes<OwnerUpdatedEventModel>
  >
  implements IEventModel
{
  declare public owner: AddressLike;
  declare public accountId: RepoDriverId;
  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        owner: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        accountId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        underscored: true,
        timestamps: true,
        schema: getSchema(),
        tableName: 'owner_updated_events',
      },
    );
  }
}
