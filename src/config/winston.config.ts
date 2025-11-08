import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { join } from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, stack }) => {
    const contextString = context ? `[${context}] ` : '';
    const stackString = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}: ${contextString}${message}${stackString}`;
  }),
);

// Create transports array based on environment
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [
    // Always include console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ];

  // Only add file transports in development or when explicitly enabled
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    transports.push(
      // File transport for all logs
      new winston.transports.File({
        filename: join(process.cwd(), 'logs', 'application.log'),
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),

      // File transport for error logs only
      new winston.transports.File({
        filename: join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );
  }

  return transports;
};

// Create exception and rejection handlers based on environment
const createExceptionHandlers = () => {
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    return [
      new winston.transports.File({
        filename: join(process.cwd(), 'logs', 'exceptions.log'),
        format: logFormat,
      }),
    ];
  }
  return [];
};

const createRejectionHandlers = () => {
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    return [
      new winston.transports.File({
        filename: join(process.cwd(), 'logs', 'rejections.log'),
        format: logFormat,
      }),
    ];
  }
  return [];
};

export const winstonConfig: WinstonModuleOptions = {
  level: process.env.LOG_LEVEL || 'info',
  transports: createTransports(),
  exceptionHandlers: createExceptionHandlers(),
  rejectionHandlers: createRejectionHandlers(),
};
