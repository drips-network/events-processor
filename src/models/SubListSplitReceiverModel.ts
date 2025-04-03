import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import { DependencyType } from '../core/types';
import type {
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../core/types';
import DripListModel from './DripListModel';
import GitProjectModel from './GitProjectModel';
import SubListModel from './SubListModel';
import EcosystemModel from './EcosystemModel';

export default class SubListSplitReceiverModel extends Model<
  InferAttributes<SubListSplitReceiverModel>,
  InferCreationAttributes<SubListSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key
  public declare fundeeSubListId: ImmutableSplitsDriverId; // Foreign key
  public declare funderProjectId: RepoDriverId | null; // Foreign key
  public declare funderDripListId: NftDriverId | null; // Foreign key
  public declare funderEcosystemId: NftDriverId | null; // Foreign key
  public declare funderSubListId: ImmutableSplitsDriverId | null; // Foreign key

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
        fundeeSubListId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: SubListModel,
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
        funderSubListId: {
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
        tableName: 'SubListSplitReceivers',
        indexes: [
          {
            fields: ['fundeeSubListId'],
            name: `IX_SubListSplitReceivers_fundeeImmutableSplitsId`,
            unique: false,
          },
          {
            fields: ['funderProjectId'],
            name: `IX_SubListSplitReceivers_funderProjectId`,
            where: {
              type: DependencyType.ProjectDependency,
            },
            unique: false,
          },
          {
            fields: ['funderDripListId'],
            name: `IX_SubListSplitReceivers_funderDripListId`,
            where: {
              type: DependencyType.DripListDependency,
            },
            unique: false,
          },
          {
            fields: ['funderEcosystemId'],
            name: `IX_SubListSplitReceivers_funderEcosystemId`,
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
