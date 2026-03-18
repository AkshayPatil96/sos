import winston from 'winston';
import { config } from '@/shared/config';
import { getRequestId } from '@/lib/requestContext';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(LOG_COLORS);

// Add a custom format that injects requestId from the context
const injectRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId !== 'no-request-context') {
    info['requestId'] = requestId;
  }
  return info;
});

const devFormat = winston.format.combine(
  injectRequestId(),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? `  ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack as string}` : '';
    return `[${timestamp as string}] [${level}]: ${message as string}${metaStr}${stackStr}`;
  }),
);

const prodFormat = winston.format.combine(
  injectRequestId(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.NODE_ENV === 'production' ? prodFormat : devFormat,
  }),
];

if (config.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat,
    }),
  );
}

export const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: config.LOG_LEVEL,
  defaultMeta: { service: config.APP_NAME, env: config.NODE_ENV },
  transports,
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});
