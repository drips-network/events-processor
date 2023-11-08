import winston from 'winston';
import appSettings from './appSettings';

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, requestId }) =>
      `${timestamp} ${level}${requestId ? ` [${requestId}]` : ''}: ${message}`,
  ),
);

const developmentLogger = winston.createLogger({
  level: appSettings.logLevel,
  format,
  transports: [new winston.transports.Console()],
});

const productionLogger = winston.createLogger({
  level: appSettings.logLevel,
  format,
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({
    //   filename: `logs/${new Date().toISOString().slice(0, 10)}.log`,
    // }),
  ],
});

const logger =
  appSettings.environment === 'mainnet' ? productionLogger : developmentLogger;

// TODO: disable Sequelize logging in production.
// export const shouldEnableSequelizeLogging =
//   appSettings.environment === 'development';
export const shouldEnableSequelizeLogging = false;

export default logger;
