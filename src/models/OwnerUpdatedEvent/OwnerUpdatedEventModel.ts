import type { InferAttributes, InferCreationAttributes } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../../common/constants';
import type { IEventModel } from '../../common/types';
import getSchema from '../../utils/getSchema';
import sequelizeInstance from '../../utils/getSequelizeInstance';

export default class OwnerUpdatedEventModel
  extends Model<
    InferAttributes<OwnerUpdatedEventModel>,
    InferCreationAttributes<OwnerUpdatedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare owner: string;
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
        owner: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        schema: getSchema(),
        sequelize: sequelizeInstance,
        tableName: 'OwnerUpdatedEvents',
      },
    );
  }
}
