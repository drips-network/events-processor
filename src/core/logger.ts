import winston from 'winston';
import fs from 'fs';
import path from 'path';
import appSettings from '../config/appSettings';

// Ensure the log directory exists before writing to files.
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const baseFormats = [
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
];

const logFormat = winston.format.printf(
  ({ timestamp, level, message, requestId, stack, ...meta }) => {
    const requestTag = requestId ? ` [${requestId}]` : '';

    const metaStr =
      meta && Object.keys(meta.metadata || {}).length
        ? `\n${JSON.stringify(meta.metadata, null, 2)}`
        : '';

    const logText = `${timestamp} ${level}${requestTag}: ${message}${metaStr}`;
    return stack ? `${logText}\n${stack}` : logText;
  },
);

const jsonFormat = winston.format.combine(
  ...baseFormats,
  winston.format.json(),
);

const textFormat = winston.format.combine(...baseFormats, logFormat);

const consoleFormat =
  appSettings.logger.format === 'json'
    ? jsonFormat
    : winston.format.combine(
        ...(process.env.NODE_ENV === 'development'
          ? [winston.format.colorize()]
          : []),
        textFormat,
      );

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: appSettings.logger.level,
    format: consoleFormat,
  }),
];

// const fileFormat =
//   appSettings.logger.format === 'json' ? jsonFormat : textFormat;
// if (appSettings.network === 'mainnet') {
//   transports.push(
//     new winston.transports.File({
//       filename: path.join(
//         logDir,
//         `${new Date().toISOString().slice(0, 10)}.log`,
//       ),
//       level: appSettings.logger.level,
//       format: fileFormat,
//       maxFiles: 7, // Keep last 7 log files
//       maxsize: 10 * 1024 * 1024, // Rotate at 10MB per file
//       tailable: true, // Keep the latest log file active
//     }),
//   );
// }

const logger = winston.createLogger({
  level: appSettings.logger.level,
  transports,
});

// Handle logging errors gracefully
logger.on('error', (err) => {
  console.error('Logger encountered an error:', err);
});

export default logger;
