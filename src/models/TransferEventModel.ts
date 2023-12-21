import type { AddressLike } from 'ethers';
import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { NftDriverId } from '../core/types';
import getSchema from '../utils/getSchema';
import type { IEventModel } from '../events/types';
import { getCommonEventAttributes } from '../utils/eventUtils';

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
        ...getCommonEventAttributes(),
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'TransferEvents',
      },
    );
  }
}
