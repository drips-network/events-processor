import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { NftDriverId, ImmutableSplitsDriverId } from '../core/types';
import getSchema from '../utils/getSchema';

export default class SubListModel extends Model<
  InferAttributes<SubListModel>,
  InferCreationAttributes<SubListModel>
> {
  // Populated from `CreatedSplits` event:
  public declare id: ImmutableSplitsDriverId;

  // Populated from `AccountMetadataEmitted` event:
  public declare name: string | null;
  public declare description: string | null;
  public declare ecosystemId: NftDriverId | null;
  public declare lastProcessedIpfsHash: string | null;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        ecosystemId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'Ecosystems',
            key: 'id',
          },
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
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
        tableName: 'SubLists',
        indexes: [
          {
            fields: ['ecosystemId'],
            name: `IX_SubLists_ecosystemId`,
            unique: false,
          },
        ],
      },
    );
  }
}
