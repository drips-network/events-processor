import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { UUID } from 'crypto';
import type { AccountId, DripListId } from '../core/types';
import getSchema from '../utils/getSchema';

export default class DripListModel extends Model<
  InferAttributes<DripListModel>,
  InferCreationAttributes<DripListModel>
> {
  public declare id: DripListId; // The `tokenId` from `TransferEvent` event.
  public declare isValid: boolean;
  public declare name: string | null;
  public declare creator: AddressLike;
  public declare description: string | null;
  public declare ownerAddress: AddressLike;
  public declare ownerAccountId: AccountId;
  public declare previousOwnerAddress: AddressLike;
  public declare latestVotingRoundId: UUID | null;
  public declare isVisible: boolean | null;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        isValid: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        ownerAddress: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ownerAccountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        latestVotingRoundId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        creator: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        previousOwnerAddress: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        isVisible: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'DripLists',
        indexes: [
          {
            fields: ['ownerAddress'],
            name: `IX_DripLists_ownerAddress`,
            where: {
              isValid: true,
            },
            unique: false,
          },
        ],
      },
    );
  }
}
