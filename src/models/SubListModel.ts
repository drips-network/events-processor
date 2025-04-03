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
  public declare id: ImmutableSplitsDriverId;
  public declare parentDripListId: NftDriverId | null;
  public declare parentEcosystemId: NftDriverId | null;
  public declare parentSubListId: ImmutableSplitsDriverId | null;
  public declare rootDripListId: NftDriverId | null;
  public declare rootEcosystemId: NftDriverId | null;
  public declare lastProcessedIpfsHash: string | null;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        parentDripListId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'DripLists',
            key: 'id',
          },
        },
        parentEcosystemId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'Ecosystems',
            key: 'id',
          },
        },
        parentSubListId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'SubLists',
            key: 'id',
          },
        },
        rootDripListId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'DripLists',
            key: 'id',
          },
        },
        rootEcosystemId: {
          // Foreign key
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'Ecosystems',
            key: 'id',
          },
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
            fields: ['parentDripListId'],
            name: `IX_SubLists_parentDripListId`,
            unique: false,
          },
          {
            fields: ['parentEcosystemId'],
            name: `IX_SubLists_parentEcosystemId`,
            unique: false,
          },
          {
            fields: ['parentSubListId'],
            name: `IX_SubLists_parentSubListId`,
            unique: false,
          },
          {
            fields: ['rootDripListId'],
            name: `IX_SubLists_rootDripListId`,
            unique: false,
          },
          {
            fields: ['rootEcosystemId'],
            name: `IX_SubLists_rootEcosystemId`,
            unique: false,
          },
        ],
      },
    );
  }
}
