/**
 * Logger - Clean logging abstraction for tools registry
 * 
 * Provides structured logging with levels and context
 * Replaces console.log statements with proper logging
 */

export class Logger {
  constructor(context = 'ToolsRegistry', options = {}) {
    this.context = context;
    this.options = {
      level: 'INFO',
      verbose: false,
      ...options
    };
    
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
  }
  
  /**
   * Create logger with specific context
   * @param {string} context - Context/component name
   * @param {Object} options - Logger options
   * @returns {Logger} Logger instance
   */
  static create(context, options = {}) {
    return new Logger(context, options);
  }
  
  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  debug(message, metadata = {}) {
    if (this._shouldLog('DEBUG')) {
      this._log('DEBUG', message, metadata);
    }
  }
  
  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  info(message, metadata = {}) {
    if (this._shouldLog('INFO')) {
      this._log('INFO', message, metadata);
    }
  }
  
  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  warn(message, metadata = {}) {
    if (this._shouldLog('WARN')) {
      this._log('WARN', message, metadata);
    }
  }
  
  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  error(message, metadata = {}) {
    if (this._shouldLog('ERROR')) {
      this._log('ERROR', message, metadata);
    }
  }
  
  /**
   * Log verbose message (only when verbose mode is enabled)
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  verbose(message, metadata = {}) {
    if (this.options.verbose || this._shouldLog('DEBUG')) {
      this._log('VERBOSE', message, metadata);
    }
  }
  
  /**
   * Check if message should be logged based on level
   * @private
   * @param {string} level - Log level
   * @returns {boolean} Should log
   */
  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.options.level];
  }
  
  /**
   * Perform actual logging
   * @private
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {Object} metadata - Additional metadata
   */
  _log(level, message, metadata) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...metadata
    };
    
    // For now, still use console but with structured format
    // Later this could be replaced with proper logging service
    const logMessage = `[${timestamp}] ${level} [${this.context}]: ${message}`;
    
    switch (level) {
      case 'ERROR':
        console.error(logMessage, metadata);
        break;
      case 'WARN':
        console.warn(logMessage, metadata);
        break;
      case 'DEBUG':
      case 'VERBOSE':
        console.debug(logMessage, metadata);
        break;
      default:
        console.log(logMessage, metadata);
    }
  }
}

// Default logger instance for convenience
export const defaultLogger = Logger.create('ToolsRegistry');