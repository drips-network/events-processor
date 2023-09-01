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

export default class AddressDriverSplitReceiverModel extends Model<
  InferAttributes<AddressDriverSplitReceiverModel>,
  InferCreationAttributes<AddressDriverSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key
  public declare funderProjectId: ProjectId; // Foreign key

  public declare weight: number;
  public declare accountId: string;

  public static initialize(): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
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
        accountId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        schema: getSchema(),
        tableName: 'AddressDriverSplitReceivers',
        sequelize: sequelizeInstance,
      },
    );
  }
}
