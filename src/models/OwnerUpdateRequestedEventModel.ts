import type {
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { Forge, IEventModel, RepoDriverAccountId } from '../common/types';
import getSchema from '../utils/getSchema';
import { COMMON_EVENT_INIT_ATTRIBUTES, FORGES_MAP } from '../common/constants';

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
  public declare accountId: RepoDriverAccountId;

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
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'OwnerUpdateRequestedEvents',
      },
    );
  }
}
