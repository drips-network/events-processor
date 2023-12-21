import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { RepoDriverId } from '../core/types';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';
import { getCommonEventAttributes } from '../utils/eventUtils';

export default class OwnerUpdatedEventModel
  extends Model<
    InferAttributes<OwnerUpdatedEventModel>,
    InferCreationAttributes<OwnerUpdatedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare owner: AddressLike;
  public declare accountId: RepoDriverId;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        owner: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...getCommonEventAttributes(),
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'OwnerUpdatedEvents',
      },
    );
  }
}
