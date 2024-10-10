import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import getSchema from '../utils/getSchema';

export default class _LastIndexedBlockModel extends Model<
  InferAttributes<_LastIndexedBlockModel>,
  InferCreationAttributes<_LastIndexedBlockModel>
> {
  public declare blockNumber: bigint;
  public declare id: number;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        blockNumber: {
          type: DataTypes.BIGINT,
          allowNull: false,
          unique: true,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: '_LastIndexedBlock',
      },
    );
  }
}
