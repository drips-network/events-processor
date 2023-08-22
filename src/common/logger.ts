import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`,
  ),
);

const developmentLogger = winston.createLogger({
  level: 'debug',
  format,
  transports: [new winston.transports.Console()],
});

const productionLogger = winston.createLogger({
  level: 'info',
  format,
  transports: [
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

const logger =
  process.env.NODE_ENV === 'production' ? productionLogger : developmentLogger;

// TODO: disable Sequelize logging in production.
// export const shouldEnableSequelizeLogging =
//   process.env.NODE_ENV === 'development';
export const shouldEnableSequelizeLogging = false;

export default logger;
