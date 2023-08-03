import type { InitOptions } from 'sequelize';
import { DataTypes } from 'sequelize';
import type { IModelDefinition } from '../../common/types';
import createEventAttributes from '../../utils/create-event-attributes';
import createInitOptions from '../../utils/create-init-options';
import type { IEventModelBaseAttributes } from '../../common/EventModelBase';
import { EventModelBase } from '../../common/EventModelBase';

export interface IOwnerUpdateRequestedEventAttributes
  extends IEventModelBaseAttributes {
  name: string;
  forge: number;
  accountId: string;
}

class OwnerUpdateRequestedEventModel
  extends EventModelBase
  implements IOwnerUpdateRequestedEventAttributes
{
  public name!: string;
  public forge!: number;
  public accountId!: string;
}

export class OwnerUpdateRequestedEventModelDefinition
  implements
    IModelDefinition<
      OwnerUpdateRequestedEventModel,
      IOwnerUpdateRequestedEventAttributes
    >
{
  public static model = OwnerUpdateRequestedEventModel;

  public attributes = createEventAttributes({
    accountId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    forge: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  public initOptions: InitOptions = createInitOptions({
    modelName: 'OwnerUpdateRequestedEventModel',
    tableName: 'OwnerUpdateRequestedEvents',
  });
}
