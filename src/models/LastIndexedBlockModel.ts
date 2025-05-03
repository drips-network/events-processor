import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';

export default class LastIndexedBlockModel extends Model<
  InferAttributes<LastIndexedBlockModel>,
  InferCreationAttributes<LastIndexedBlockModel>
> {
  declare public blockNumber: bigint;
  declare public id: number;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          primaryKey: true,
          autoIncrement: true,
          type: DataTypes.INTEGER,
        },
        blockNumber: {
          unique: true,
          allowNull: false,
          type: DataTypes.BIGINT,
        },
        createdAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'last_indexed_block',
        underscored: true,
      },
    );
  }
}
