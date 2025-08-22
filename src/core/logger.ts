import winston from 'winston';
import type { LoggingConfig } from '../config/appSettings.schema';
import appSettings from '../config/appSettings';

function createLogger(config: LoggingConfig): winston.Logger {
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ];

  // Add pretty printing for console if configured.
  if (config.format === 'pretty' && config.destination === 'console') {
    formats.push(
      winston.format.colorize(),
      winston.format.printf((info: winston.Logform.TransformableInfo) => {
        const { level, message, timestamp, metadata, ...rest } = info;
        const metaStr =
          metadata || Object.keys(rest).length
            ? `\n${JSON.stringify(metadata || rest, null, 2)}`
            : '';

        return `${timestamp} ${level}: ${message}${metaStr}`;
      }),
    );
  } else {
    formats.push(winston.format.json());
  }

  const transports: winston.transport[] = [];

  // Configure transport based on destination.
  if (config.destination === 'file' && config.filename) {
    transports.push(
      new winston.transports.File({
        filename: config.filename,
        level: config.level,
        format: winston.format.combine(...formats),
        maxFiles: 7,
        maxsize: 10 * 1024 * 1024, // 10MB
        tailable: true,
      }),
    );
  } else {
    transports.push(
      new winston.transports.Console({
        level: config.level,
        format: winston.format.combine(...formats),
      }),
    );
  }

  return winston.createLogger({
    level: config.level,
    transports,
  });
}

// Singleton logger instance
const logger = createLogger(appSettings.logger);
export default logger;
