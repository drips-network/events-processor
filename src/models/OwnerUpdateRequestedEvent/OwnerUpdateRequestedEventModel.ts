import type { InferAttributes, InferCreationAttributes } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../../common/types';
import sequelizeInstance from '../../utils/getSequelizeInstance';
import getSchema from '../../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../../common/constants';

export default class OwnerUpdateRequestedEventModel
  extends Model<
    InferAttributes<OwnerUpdateRequestedEventModel>,
    InferCreationAttributes<OwnerUpdateRequestedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare forge: number;
  public declare name: string;
  public declare accountId: string;

  // Common event log properties.
  public declare rawEvent: string;
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(): void {
    this.init(
      {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        forge: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        schema: getSchema(),
        sequelize: sequelizeInstance,
        tableName: 'OwnerUpdateRequestedEvents',
      },
    );
  }
}
