import type { InitOptions } from 'sequelize';
import { DataTypes } from 'sequelize';
import type { IModelDefinition } from '../../common/types';
import createInitOptions from '../../utils/create-init-options';
import createEventAttributes from '../../utils/create-event-attributes';
import type { IEventModelBaseAttributes } from '../../common/EventModelBase';
import { EventModelBase } from '../../common/EventModelBase';

export interface IAccountMetadataEmittedEventAttributes
  extends IEventModelBaseAttributes {
  key: string;
  value: string;
  accountId: string;
}

export class AccountMetadataEmittedEventModel
  extends EventModelBase
  implements IAccountMetadataEmittedEventAttributes
{
  public key!: string;
  public value!: string;
  public accountId!: string;
}

export default class AccountMetadataEmittedEventModelDefinition
  implements
    IModelDefinition<
      AccountMetadataEmittedEventModel,
      IAccountMetadataEmittedEventAttributes
    >
{
  public static model = AccountMetadataEmittedEventModel;

  public attributes = createEventAttributes({
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
  });

  public initOptions: InitOptions = createInitOptions({
    modelName: 'AccountMetadataEmittedEventModel',
    tableName: 'AccountMetadataEmittedEvents',
  });
}
