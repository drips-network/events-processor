import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';
import sequelizeInstance from '../db/getSequelizeInstance';
import GitProjectModel from './GitProjectModel';
import type { ProjectId } from '../common/types';

export default class RepoDriverSplitReceiverModel extends Model<
  InferAttributes<RepoDriverSplitReceiverModel>,
  InferCreationAttributes<RepoDriverSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key

  public declare selfProjectId: ProjectId; // Foreign key
  public declare funderProjectId: ProjectId; // Foreign key

  public declare weight: number;

  public static initialize(): void {
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
          allowNull: false,
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        schema: getSchema(),
        tableName: 'RepoDriverSplitReceivers',
        sequelize: sequelizeInstance,
      },
    );
  }
}
