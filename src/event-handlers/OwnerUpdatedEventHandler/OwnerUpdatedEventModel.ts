// eslint-disable-next-line max-classes-per-file
import type { InitOptions } from 'sequelize';
import { DataTypes } from 'sequelize';
import type { IModelDefinition } from '../../common/types';
import createEventAttributes from '../../utils/create-event-attributes';
import createInitOptions from '../../utils/create-init-options';
import {
  EventModelBase,
  type IEventModelBaseAttributes,
} from '../../common/EventModelBase';

export interface IOwnerUpdatedEventAttributes
  extends IEventModelBaseAttributes {
  accountId: string;
  ownerAddress: string;
}

class OwnerUpdatedEventModel
  extends EventModelBase
  implements IOwnerUpdatedEventAttributes
{
  public accountId!: string;
  public ownerAddress!: string;
}
export class OwnerUpdatedEventModelDefinition
  implements
    IModelDefinition<OwnerUpdatedEventModel, IOwnerUpdatedEventAttributes>
{
  public static model = OwnerUpdatedEventModel;

  public attributes = createEventAttributes({
    accountId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ownerAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  public initOptions: InitOptions = createInitOptions({
    modelName: 'OwnerUpdatedEventModel',
    tableName: 'OwnerUpdatedEvents',
  });
}
