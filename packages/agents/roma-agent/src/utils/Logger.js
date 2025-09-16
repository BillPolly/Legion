/**
 * Logger - Structured logging utility
 * Replaces console statements with proper logging
 */

export class Logger {
  constructor(name, options = {}) {
    this.name = name;
    this.level = options.level || 'info';
    this.output = options.output || console;
    this.formatter = options.formatter || this.defaultFormatter.bind(this);
    
    // Log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
  }

  /**
   * Check if level should be logged
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Default log formatter
   */
  defaultFormatter(level, message, metadata) {
    const timestamp = new Date().toISOString();
    const context = this.name ? `[${this.name}]` : '';
    const metaStr = Object.keys(metadata).length > 0 
      ? JSON.stringify(metadata) 
      : '';
    
    return `${timestamp} ${level.toUpperCase()} ${context} ${message} ${metaStr}`.trim();
  }

  /**
   * Log at error level
   */
  error(message, metadata = {}) {
    if (this.shouldLog('error')) {
      const formatted = this.formatter('error', message, metadata);
      this.output.error(formatted);
    }
  }

  /**
   * Log at warn level
   */
  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatter('warn', message, metadata);
      this.output.warn(formatted);
    }
  }

  /**
   * Log at info level
   */
  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      const formatted = this.formatter('info', message, metadata);
      this.output.log(formatted);
    }
  }

  /**
   * Log at debug level
   */
  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatter('debug', message, metadata);
      this.output.log(formatted);
    }
  }

  /**
   * Log at trace level
   */
  trace(message, metadata = {}) {
    if (this.shouldLog('trace')) {
      const formatted = this.formatter('trace', message, metadata);
      this.output.log(formatted);
    }
  }

  /**
   * Create child logger with additional context
   */
  child(name) {
    return new Logger(`${this.name}:${name}`, {
      level: this.level,
      output: this.output,
      formatter: this.formatter
    });
  }

  /**
   * Set logging level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }
}