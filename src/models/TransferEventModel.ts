import type { AddressLike } from 'ethers';
import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { NftDriverId } from '../core/types';
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
  public declare tokenId: NftDriverId; // The `tokenId` from `Transfer` event.
  public declare from: AddressLike;
  public declare to: AddressLike;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        tokenId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        from: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        to: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'TransferEvents',
      },
    );
  }
}
