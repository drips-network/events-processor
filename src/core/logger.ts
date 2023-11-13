import winston from 'winston';
import appSettings from '../config/appSettings';

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
    // Logs are stored on Railways, so we don't need to store them locally.
    // new winston.transports.File({
    //   filename: `logs/${new Date().toISOString().slice(0, 10)}.log`,
    // }),
  ],
});

const logger =
  appSettings.environment === 'mainnet' ? productionLogger : developmentLogger;

export const shouldEnableSequelizeLogging =
  appSettings.environment !== 'mainnet';

export default logger;
