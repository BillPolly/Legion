/**
 * Minimal LogManager for MCP Bridge
 * 
 * Provides basic logging functionality for the stdio MCP server.
 * The full LogManager remains in the Aiur package for the server.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LogManager {
  constructor(config = {}) {
    this.config = {
      enableFileLogging: config.enableFileLogging !== false,
      logDirectory: config.logDirectory || './logs',
      logRetentionDays: config.logRetentionDays || 7,
      maxLogFileSize: config.maxLogFileSize || 10 * 1024 * 1024
    };
    
    this.logFile = null;
    this.logStream = null;
  }

  async initialize() {
    if (this.config.enableFileLogging) {
      // Create log directory if it doesn't exist
      const logDir = path.resolve(this.config.logDirectory);
      await fs.promises.mkdir(logDir, { recursive: true });
      
      // Create log file
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      this.logFile = path.join(logDir, `mcp-bridge-${timestamp}.log`);
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    }
  }

  async logInfo(message, context = {}) {
    await this._log('INFO', message, context);
  }

  async logWarning(message, context = {}) {
    await this._log('WARN', message, context);
  }

  async logError(error, context = {}) {
    const message = error instanceof Error ? error.message : String(error);
    const errorContext = {
      ...context,
      stack: error instanceof Error ? error.stack : undefined
    };
    await this._log('ERROR', message, errorContext);
  }

  async _log(level, message, context) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };

    // Write to file if enabled
    if (this.logStream) {
      this.logStream.write(JSON.stringify(logEntry) + '\n');
    }

    // For MCP bridge, we avoid console output to not interfere with stdio
  }

  async shutdown() {
    if (this.logStream) {
      return new Promise((resolve) => {
        this.logStream.end(() => {
          this.logStream = null;
          resolve();
        });
      });
    }
  }
}

export default LogManager;