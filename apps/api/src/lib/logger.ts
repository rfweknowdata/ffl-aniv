import pino from 'pino';
import { config } from '../config.js';

export const loggerOptions = {
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
};

/** For use outside a Fastify request context (cron jobs, one-off scripts). */
export const logger = pino(loggerOptions);
