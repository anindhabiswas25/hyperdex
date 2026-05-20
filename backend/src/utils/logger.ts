import winston from 'winston';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const devFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'HH:mm:ss' }),
  colorize(),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${message}${extra}`;
  })
);

const prodFormat = combine(errors({ stack: true }), timestamp(), json());

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: prodFormat }),
    new winston.transports.File({ filename: 'logs/combined.log', format: prodFormat }),
  ],
});
