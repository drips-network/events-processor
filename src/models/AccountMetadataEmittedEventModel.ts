import { DataTypes, Model } from 'sequelize';
import createInitOptions from '../utils/create-init-options';
import type { IEventModel } from '../common/types';
import createEventInitAttributes from '../utils/create-event-init-attributes';

export default class AccountMetadataEmittedEventModel
  extends Model
  implements IEventModel
{
  public id!: number; // Primary key
  public rawEvent!: string;
  public logIndex!: number;
  public blockNumber!: number;
  public blockTimestamp!: Date;
  public transactionHash!: string;

  public key!: string;
  public value!: string;
  public accountId!: string;

  public static initialize(): void {
    this.init(
      createEventInitAttributes({
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        key: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      }),
      createInitOptions({
        modelName: 'AccountMetadataEmittedEventModel',
        tableName: 'AccountMetadataEmittedEvents',
      }),
    );
  }
}
