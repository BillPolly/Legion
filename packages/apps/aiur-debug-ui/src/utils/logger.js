/**
 * Logger utility for the debug UI
 */

import winston from 'winston';

/**
 * Create a Winston logger instance
 * @param {Object} options - Logger configuration options
 * @param {string} [options.level='info'] - Log level
 * @param {boolean} [options.console=true] - Enable console transport
 * @param {string} [options.file] - File path for file transport
 * @returns {Object} Logger instance with bound convenience methods
 */
export function createLogger(options = {}) {
  const {
    level = 'info',
    console: enableConsole = true,
    file
  } = options;
  
  const transports = [];
  
  // Console transport with formatting
  if (enableConsole) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${message} ${metaStr}`;
        })
      )
    }));
  }
  
  // File transport with JSON formatting
  if (file) {
    transports.push(new winston.transports.File({
      filename: file,
      format: winston.format.json()
    }));
  }
  
  const logger = winston.createLogger({
    level,
    transports
  });
  
  // Bind convenience methods for easier usage
  return {
    ...logger,
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    child: (metadata) => createChildLogger(logger, metadata)
  };
}

/**
 * Create a child logger with additional metadata
 * @param {Object} parentLogger - Parent logger instance
 * @param {Object} metadata - Additional metadata for child logger
 * @returns {Object} Child logger instance
 */
export function createChildLogger(parentLogger, metadata) {
  return parentLogger.child(metadata);
}