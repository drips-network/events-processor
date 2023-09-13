import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import GitProjectModel from './GitProjectModel';
import type { DripListId, ProjectId } from '../common/types';
import DripListModel from './DripListModel';

export default class RepoDriverSplitReceiverModel extends Model<
  InferAttributes<RepoDriverSplitReceiverModel>,
  InferCreationAttributes<RepoDriverSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key

  public declare selfProjectId: ProjectId; // Foreign key
  public declare funderProjectId: ProjectId | null; // Foreign key
  public declare funderDripListId: DripListId | null; // Foreign key

  public declare weight: number;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        selfProjectId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: GitProjectModel,
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
        weight: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'RepoDriverSplitReceivers',
      },
    );
  }
}
