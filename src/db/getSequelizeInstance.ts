import { Sequelize } from 'sequelize';
import logger, { shouldEnableSequelizeLogging } from '../common/logger';
import config from './config';

const { postgresConnectionString } = config;

const sequelizeInstance = new Sequelize(`${postgresConnectionString}`, {
  dialect: 'postgres',
  logging: shouldEnableSequelizeLogging ? (msg) => logger.debug(msg) : false,
  timezone: 'UTC',
});

export default sequelizeInstance;
