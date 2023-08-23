import { DataTypes, Model } from 'sequelize';
import type { IEventModel } from '../common/types';
import createInitOptions from '../utils/create-init-options';
import createEventInitAttributes from '../utils/create-event-init-attributes';

export default class OwnerUpdateRequestedEventModel
  extends Model
  implements IEventModel
{
  public id!: number; // Primary key
  public name!: string;
  public forge!: number;
  public accountId!: string;
  public rawEvent!: string;
  public logIndex!: number;
  public blockNumber!: number;
  public blockTimestamp!: Date;
  public transactionHash!: string;

  public static initialize(): void {
    this.init(
      createEventInitAttributes({
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        forge: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      }),
      createInitOptions({
        modelName: 'OwnerUpdateRequestedEventModel',
        tableName: 'OwnerUpdateRequestedEvents',
      }),
    );
  }
}
