import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { UUID } from 'crypto';
import type { AccountId, NftDriverId } from '../core/types';
import getSchema from '../utils/getSchema';

export default class DripListModel extends Model<
  InferAttributes<DripListModel>,
  InferCreationAttributes<DripListModel>
> {
  public declare id: NftDriverId;
  public declare isValid: boolean;
  public declare name: string | null;
  public declare creator: AddressLike | null;
  public declare description: string | null;
  public declare ownerAddress: AddressLike | null;
  public declare ownerAccountId: AccountId | null;
  public declare previousOwnerAddress: AddressLike | null;
  public declare latestVotingRoundId: UUID | null;
  public declare isVisible: boolean | null;
  public declare lastProcessedIpfsHash: string | null;

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
          allowNull: true,
        },
        ownerAccountId: {
          type: DataTypes.STRING,
          allowNull: true,
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
          allowNull: true,
        },
        previousOwnerAddress: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        isVisible: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        lastProcessedIpfsHash: {
          type: DataTypes.TEXT,
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
