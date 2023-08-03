import type { InitOptions } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { IModelDefinition, SupportedContractName } from '../common/types';
import createInitOptions from '../utils/create-init-options';

export interface IProcessHistoryAttributes {
  lastProcessedBlock: number;
  contract: SupportedContractName; // Primary key.
}

class ProcessHistoryModel extends Model implements IProcessHistoryAttributes {
  lastProcessedBlock!: number;
  contract!: SupportedContractName; // Primary key.
}

export class ProcessHistoryModelDefinition
  implements IModelDefinition<ProcessHistoryModel, IProcessHistoryAttributes>
{
  public static model = ProcessHistoryModel;

  public attributes = {
    lastProcessedBlock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contract: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
  };

  public initOptions: InitOptions<ProcessHistoryModel> = createInitOptions({
    modelName: 'ProcessHistoryModel',
    tableName: 'ProcessHistory',
  });
}
