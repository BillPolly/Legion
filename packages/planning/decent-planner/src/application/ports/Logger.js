/**
 * Logger Interface - Port for logging
 * Following Clean Architecture - defines the contract for logging services
 */

export class Logger {
  /**
   * Log an informational message
   * @param {string} message - The message to log
   * @param {Object} context - Optional context data
   */
  info(message, context = {}) {
    throw new Error('Logger.info() must be implemented');
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {Object} context - Optional context data
   */
  warn(message, context = {}) {
    throw new Error('Logger.warn() must be implemented');
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {Object} context - Optional context data
   */
  error(message, context = {}) {
    throw new Error('Logger.error() must be implemented');
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {Object} context - Optional context data
   */
  debug(message, context = {}) {
    throw new Error('Logger.debug() must be implemented');
  }
}