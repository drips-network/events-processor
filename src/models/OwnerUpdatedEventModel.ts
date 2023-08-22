import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../common/types';
import createEventInitAttributes from '../utils/create-event-init-attributes';
import createInitOptions from '../utils/create-init-options';

export default class OwnerUpdatedEventModel
  extends Model
  implements IEventModel
{
  public accountId!: string;
  public rawEvent!: string;
  public logIndex!: number;
  public blockNumber!: number;
  public ownerAddress!: string;
  public blockTimestamp!: Date;
  public transactionHash!: string;

  public static initialize(): void {
    this.init(
      createEventInitAttributes({
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ownerAddress: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      }),
      createInitOptions({
        modelName: 'OwnerUpdatedEventModel',
        tableName: 'OwnerUpdatedEvents',
      }),
    );
  }
}
