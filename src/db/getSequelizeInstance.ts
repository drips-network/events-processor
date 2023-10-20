import { Sequelize } from 'sequelize';
import logger, { shouldEnableSequelizeLogging } from '../common/logger';
import config from './config';

const {
  postgresHost,
  postgresPort,
  postgresDatabase,
  postgresPassword,
  postgresUsername,
} = config;

const sequelizeInstance = new Sequelize(
  `postgres://${postgresUsername}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDatabase}`,
  {
    logging: shouldEnableSequelizeLogging ? (msg) => logger.debug(msg) : false,
    timezone: 'UTC',
  },
);

export default sequelizeInstance;
