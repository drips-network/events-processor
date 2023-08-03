import { type InitOptions } from 'sequelize';
import getSchema from './get-schema';
import sequelizeInstance from './get-sequelize-instance';

export default function createInitOptions(options: Partial<InitOptions>) {
  const { sequelize: optionsSequelize, ...restOptions } = options;

  return {
    sequelize: optionsSequelize || sequelizeInstance,
    schema: getSchema(),
    ...restOptions,
  };
}
