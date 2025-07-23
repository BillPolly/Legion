/**
 * LogManager - Simple file-based logging service
 * 
 * Provides structured logging to files with automatic rotation and cleanup.
 */

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { EventEmitter } from 'events';

export class LogManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.logDirectory = options.logDirectory || path.join(process.cwd(), 'logs');
    this.logRetentionDays = options.logRetentionDays || 7;
    this.maxLogFileSize = options.maxLogFileSize || 10 * 1024 * 1024; // 10MB
    this.enableFileLogging = options.enableFileLogging !== false;
    
    // State
    this.currentLogFile = null;
    this.currentLogStream = null;
    this.logRotationTimer = null;
    this.cleanupTimer = null;
    this.isInitialized = false;
    
    // Statistics
    this.stats = {
      totalLogged: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      rotations: 0,
      cleanups: 0
    };
  }

  /**
   * Static async factory method following the Async Resource Manager Pattern
   */
  static async create(resourceManager) {
    const options = {
      logDirectory: resourceManager.get('config')?.logDirectory || path.join(process.cwd(), 'logs'),
      logRetentionDays: resourceManager.get('config')?.logRetentionDays || 7,
      maxLogFileSize: resourceManager.get('config')?.maxLogFileSize || 10 * 1024 * 1024,
      enableFileLogging: resourceManager.get('config')?.enableFileLogging !== false
    };
    
    const logManager = new LogManager(options);
    await logManager.initialize();
    
    // Register with ResourceManager
    resourceManager.register('logManager', logManager);
    
    return logManager;
  }

  /**
   * Initialize the log manager
   */
  async initialize() {
    if (!this.enableFileLogging) {
      return;
    }
    
    try {
      // Create log directory if it doesn't exist
      await this.ensureLogDirectory();
      
      // Rotate existing log file on startup (moves old file to archived)
      await this.rotateLogOnStartup();
      
      // Open the log file for writing
      await this.openLogFile();
      
      // Schedule rotation check every hour
      this.logRotationTimer = setInterval(() => {
        this.checkRotation().catch(() => {});
      }, 60 * 60 * 1000); // 1 hour
      
      // Schedule cleanup every 24 hours
      this.cleanupTimer = setInterval(() => {
        this.cleanupOldLogs().catch(() => {});
      }, 24 * 60 * 60 * 1000); // 24 hours
      
      // Run initial cleanup
      await this.cleanupOldLogs();
      
      this.isInitialized = true;
      
    } catch (error) {
      // Failed to initialize LogManager - continue without logging
      this.enableFileLogging = false;
    }
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.access(this.logDirectory);
    } catch {
      await fs.mkdir(this.logDirectory, { recursive: true });
    }
  }

  /**
   * Get current log filename
   */
  getCurrentLogFilename() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `aiur-${dateStr}-${hours}-${minutes}.log`;
  }

  /**
   * Rotate existing log file on startup
   */
  async rotateLogOnStartup() {
    try {
      // Create archived subdirectory if it doesn't exist
      const archivedDir = path.join(this.logDirectory, 'archived');
      try {
        await fs.access(archivedDir);
      } catch {
        await fs.mkdir(archivedDir, { recursive: true });
      }
      
      // Move all existing log files to archived directory
      const files = await fs.readdir(this.logDirectory);
      let movedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('aiur-') && file.endsWith('.log')) {
          const oldPath = path.join(this.logDirectory, file);
          const newPath = path.join(archivedDir, file);
          
          try {
            await fs.rename(oldPath, newPath);
            movedCount++;
          } catch (error) {
            // Failed to archive log file - continue
          }
        }
      }
      
      if (movedCount > 0) {
        this.stats.rotations++;
      }
    } catch (error) {
      // Error rotating logs on startup - continue
    }
  }

  /**
   * Open or create log file
   */
  async openLogFile() {
    const filename = this.getCurrentLogFilename();
    const filepath = path.join(this.logDirectory, filename);
    
    // Close existing stream if open
    if (this.currentLogStream) {
      this.currentLogStream.end();
    }
    
    // Create new write stream with append mode
    this.currentLogStream = createWriteStream(filepath, { 
      flags: 'a',
      encoding: 'utf8'
    });
    
    this.currentLogFile = filepath;
    
    // Handle stream errors
    this.currentLogStream.on('error', (error) => {
      this.enableFileLogging = false;
    });
  }

  /**
   * Write log entry to file
   */
  async writeLog(logEntry) {
    if (!this.enableFileLogging || !this.currentLogStream) {
      return;
    }
    
    try {
      // Format as JSON with newline
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Write to stream
      const written = this.currentLogStream.write(logLine);
      
      if (!written) {
        // Handle backpressure
        await new Promise((resolve) => {
          this.currentLogStream.once('drain', resolve);
        });
      }
      
      // Update statistics
      this.stats.totalLogged++;
      if (logEntry.level === 'error') this.stats.errorCount++;
      else if (logEntry.level === 'warning') this.stats.warningCount++;
      else if (logEntry.level === 'info') this.stats.infoCount++;
      
      // Emit event for real-time log streaming
      this.emit('log-entry', logEntry);
      
    } catch (error) {
      // Failed to write log - continue
    }
  }

  /**
   * Log an error
   */
  async logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message || String(error),
      stack: error.stack,
      code: error.code,
      name: error.name,
      context,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    };
    
    await this.writeLog(logEntry);
  }

  /**
   * Log a warning
   */
  async logWarning(message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warning',
      message,
      context,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    };
    
    await this.writeLog(logEntry);
  }

  /**
   * Log info
   */
  async logInfo(message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    };
    
    await this.writeLog(logEntry);
  }

  /**
   * Log error event from ErrorBroadcastService
   */
  async logErrorEvent(errorEvent) {
    const { data } = errorEvent;
    const logEntry = {
      timestamp: errorEvent.timestamp,
      level: data.severity || 'error',
      eventId: errorEvent.id,
      errorType: data.errorType,
      source: data.source,
      message: data.error.message,
      stack: data.error.stack,
      code: data.error.code,
      details: data.error.details,
      context: data.context,
      recovery: data.recovery,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    };
    
    await this.writeLog(logEntry);
  }

  /**
   * Check if log rotation is needed
   */
  async checkRotation() {
    if (!this.currentLogFile) return;
    
    try {
      // Check if date has changed
      const currentFilename = this.getCurrentLogFilename();
      const expectedPath = path.join(this.logDirectory, currentFilename);
      
      if (this.currentLogFile !== expectedPath) {
        // Date has changed, rotate
        await this.rotateLog();
        return;
      }
      
      // Check file size
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.maxLogFileSize) {
        await this.rotateLog();
      }
      
    } catch (error) {
      // Error checking log rotation - continue
    }
  }

  /**
   * Rotate log file
   */
  async rotateLog() {
    try {
      const oldFile = this.currentLogFile;
      
      // Open new log file
      await this.openLogFile();
      
      // If size-based rotation, rename old file
      if (oldFile === this.currentLogFile) {
        const timestamp = Date.now();
        const rotatedName = oldFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(oldFile, rotatedName);
        await this.openLogFile();
      }
      
      this.stats.rotations++;
      await this.logInfo('Log rotation completed', { 
        oldFile, 
        newFile: this.currentLogFile 
      });
      
    } catch (error) {
      // Error rotating log - continue
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDirectory);
      const now = Date.now();
      const maxAge = this.logRetentionDays * 24 * 60 * 60 * 1000;
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.startsWith('aiur-')) continue;
        
        const filepath = path.join(this.logDirectory, file);
        const stats = await fs.stat(filepath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        this.stats.cleanups++;
      }
      
    } catch (error) {
      // Error cleaning up logs - continue
    }
  }

  /**
   * Get recent log entries
   */
  async getRecentLogs(options = {}) {
    const { 
      limit = 100, 
      level = null,
      startTime = null,
      endTime = null
    } = options;
    
    try {
      const filename = this.getCurrentLogFilename();
      const filepath = path.join(this.logDirectory, filename);
      
      // Read current log file only
      let logs = [];
      try {
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        logs = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(log => log);
      } catch (error) {
        // File doesn't exist yet or can't be read
        return [];
      }
      
      // Apply filters
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      
      if (startTime) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(startTime));
      }
      
      if (endTime) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(endTime));
      }
      
      // Return limited results
      return logs.slice(-limit);
      
    } catch (error) {
      // Error reading logs - return empty array
      return [];
    }
  }

  /**
   * Get all logs for web UI - reads current and recent archived logs
   */
  async getAllLogsForWebUI(limit = 500) {
    try {
      let allLogs = [];
      
      // Read current log file
      const currentLogs = await this.getRecentLogs({ limit });
      allLogs = [...currentLogs];
      
      // If we need more logs, read from archived directory
      if (allLogs.length < limit) {
        try {
          const archivedDir = path.join(this.logDirectory, 'archived');
          const archivedFiles = await fs.readdir(archivedDir);
          
          // Sort archived files by modification time (newest first)
          const fileStats = await Promise.all(
            archivedFiles
              .filter(file => file.startsWith('aiur-') && file.endsWith('.log'))
              .map(async file => {
                const filepath = path.join(archivedDir, file);
                const stats = await fs.stat(filepath);
                return { file, mtime: stats.mtime, filepath };
              })
          );
          
          fileStats.sort((a, b) => b.mtime - a.mtime);
          
          // Read from most recent archived files until we have enough logs
          for (const { filepath } of fileStats) {
            if (allLogs.length >= limit) break;
            
            try {
              const content = await fs.readFile(filepath, 'utf8');
              const lines = content.trim().split('\n').filter(line => line);
              
              const archivedLogs = lines.map(line => {
                try {
                  return JSON.parse(line);
                } catch {
                  return null;
                }
              }).filter(log => log);
              
              allLogs = [...archivedLogs, ...allLogs];
            } catch (error) {
              // Skip this file if we can't read it
            }
          }
        } catch (error) {
          // No archived directory or can't read it - continue with current logs only
        }
      }
      
      // Sort by timestamp (newest first) and limit
      allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return allLogs.slice(0, limit);
      
    } catch (error) {
      // Error reading logs - return empty array
      return [];
    }
  }

  /**
   * Get log statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Shutdown log manager
   */
  async shutdown() {
    // Clear timers
    if (this.logRotationTimer) {
      clearInterval(this.logRotationTimer);
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Close log stream
    if (this.currentLogStream) {
      await new Promise((resolve) => {
        this.currentLogStream.end(resolve);
      });
    }
    
    this.isInitialized = false;
  }
}