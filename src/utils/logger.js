/**
 * Shared Winston logger instance.
 *
 * Usage:
 *   const logger = require('./logger');
 *   logger.info('Server status fetched', { players: 5, source: 'rcon' });
 *   logger.error('RCON connection failed', { host, error: err.message, stack: err.stack });
 *
 * ═══════════════════════════════════════════════════════════════
 * LOG HYGIENE RULES — read and follow these at all times:
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. NEVER log raw secrets, tokens, passwords, or connection strings.
 *    If you need to log connection context, log the host/port only.
 *
 * 2. NEVER log full user objects — only log IDs.
 *    Good:  logger.info('Command used', { userId: interaction.user.id })
 *    Bad:   logger.info('Command used', { user: interaction.user })
 *
 * 3. NEVER log Minecraft coordinates unless the player has made them
 *    public (i.e. only log POI coordinates, never private coords from
 *    commands that accept coordinates).
 *
 * 4. Error logs MUST always include the error stack:
 *      logger.error('Operation failed', {
 *        error: err.message,
 *        stack: err.stack,
 *      })
 * ═══════════════════════════════════════════════════════════════
 */

const winston = require('winston');
require('winston-daily-rotate-file');

const { config } = require('../config');

/* ------------------------------------------------------------------ */
/*  Log level                                                         */
/* ------------------------------------------------------------------ */

const resolvedLevel = config.logLevel || 'info';

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

const { combine, timestamp, printf, json, colorize, align } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Human-readable format for development.
 */
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  align(),
  printf(({ timestamp: ts, level, message, ...meta }) => {
    const keys = Object.keys(meta);
    const metaStr =
      keys.length > 0 ? ` ${JSON.stringify(meta, null, 0)}` : '';
    return `${ts} ${level}: ${message}${metaStr}`;
  }),
);

/**
 * JSON format for production (log aggregators parse this).
 */
const prodFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json(),
);

/* ------------------------------------------------------------------ */
/*  Transports                                                        */
/* ------------------------------------------------------------------ */

const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    level: resolvedLevel,
    format: isProduction ? prodFormat : devFormat,
  }),
);

// Daily rotating file — combined logs (all levels)
transports.push(
  new winston.transports.DailyRotateFile({
    level: resolvedLevel,
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '100m',
    zippedArchive: true,
  }),
);

// Daily rotating file — error-only logs
transports.push(
  new winston.transports.DailyRotateFile({
    level: 'error',
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '100m',
    zippedArchive: true,
  }),
);

/* ------------------------------------------------------------------ */
/*  Logger instance                                                    */
/* ------------------------------------------------------------------ */

const logger = winston.createLogger({
  level: resolvedLevel,
  format: isProduction ? prodFormat : devFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
