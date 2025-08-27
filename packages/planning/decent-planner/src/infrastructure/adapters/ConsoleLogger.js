/**
 * ConsoleLogger - Infrastructure adapter for console-based logging
 * Implements the Logger port
 */

import { Logger } from '../../application/ports/Logger.js';

export class ConsoleLogger extends Logger {
  constructor(options = {}) {
    super();
    this.level = options.level || 'info';
    this.prefix = options.prefix || '[DecentPlanner]';
    this.enableTimestamp = options.enableTimestamp !== false;
    
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  formatMessage(level, message, context) {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : '';
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = Object.keys(context).length > 0 
      ? ' ' + JSON.stringify(context) 
      : '';
    
    return `${timestamp} ${this.prefix} ${levelStr} ${message}${contextStr}`;
  }

  info(message, context = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message, context = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }
}