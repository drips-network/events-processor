import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { Address, NftDriverId } from '../core/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../core/constants';
import type { IEventModel } from '../events/types';

export default class TransferEventModel
  extends Model<
    InferAttributes<TransferEventModel>,
    InferCreationAttributes<TransferEventModel>
  >
  implements IEventModel
{
  declare public tokenId: NftDriverId; // The `tokenId` from `Transfer` event.
  declare public from: Address;
  declare public to: Address;
  declare public logIndex: number;
  declare public blockNumber: number;
  declare public blockTimestamp: Date;
  declare public transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        tokenId: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        from: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        to: {
          allowNull: false,
          type: DataTypes.STRING,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'transfer_events',
      },
    );
  }
}
