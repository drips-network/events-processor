import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { Forge, RepoDriverId } from '../core/types';
import getSchema from '../utils/getSchema';
import { FORGES_MAP } from '../core/constants';
import type { IEventModel } from '../events/types';
import { getCommonEventAttributes } from '../utils/eventUtils';

export default class OwnerUpdateRequestedEventModel
  extends Model<
    InferAttributes<OwnerUpdateRequestedEventModel>,
    InferCreationAttributes<OwnerUpdateRequestedEventModel>
  >
  implements IEventModel
{
  // Properties from event output.
  public declare forge: Forge;
  public declare name: string;
  public declare accountId: RepoDriverId;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
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
          type: DataTypes.ENUM(...Object.values(FORGES_MAP)),
          allowNull: false,
        },
        ...getCommonEventAttributes(),
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'OwnerUpdateRequestedEvents',
      },
    );
  }
}
