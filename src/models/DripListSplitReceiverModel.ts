import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import { DependencyType } from '../core/types';
import type { NftDriverId, RepoDriverId } from '../core/types';
import DripListModel from './DripListModel';
import GitProjectModel from './GitProjectModel';
import EcosystemModel from './EcosystemModel';

export default class DripListSplitReceiverModel extends Model<
  InferAttributes<DripListSplitReceiverModel>,
  InferCreationAttributes<DripListSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key
  public declare fundeeDripListId: NftDriverId; // Foreign key
  public declare funderProjectId: RepoDriverId | null; // Foreign key
  public declare funderDripListId: NftDriverId | null; // Foreign key
  public declare funderEcosystemId: NftDriverId | null; // Foreign key

  public declare weight: number;
  public declare type: DependencyType;
  public declare blockTimestamp: Date;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        fundeeDripListId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: DripListModel,
            key: 'id',
          },
          allowNull: false,
        },
        funderProjectId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: GitProjectModel,
            key: 'id',
          },
          allowNull: true,
        },
        funderDripListId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: DripListModel,
            key: 'id',
          },
          allowNull: true,
        },
        funderEcosystemId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: EcosystemModel,
            key: 'id',
          },
          allowNull: true,
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM(...Object.values(DependencyType)),
          allowNull: false,
        },
        blockTimestamp: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'DripListSplitReceivers',
        indexes: [
          {
            fields: ['fundeeDripListId'],
            name: `IX_DripListSplitReceivers_fundeeDripListId`,
            unique: false,
          },
          {
            fields: ['funderProjectId'],
            name: `IX_DripListSplitReceivers_funderProjectId`,
            where: {
              type: DependencyType.ProjectDependency,
            },
            unique: false,
          },
          {
            fields: ['funderDripListId'],
            name: `IX_DripListSplitReceivers_funderDripListId`,
            where: {
              type: DependencyType.DripListDependency,
            },
            unique: false,
          },
          {
            fields: ['funderEcosystemId'],
            name: `IX_DripListSplitReceivers_funderEcosystemId`,
            where: {
              type: DependencyType.EcosystemDependency,
            },
            unique: false,
          },
        ],
      },
    );
  }
}
