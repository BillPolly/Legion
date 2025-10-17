/**
 * FileLogger - File-based logging with rotation for VSCode Orchestrator
 * Logs all WebSocket messages, commands, and errors to rotating log files
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class FileLogger {
  private logDir: string;
  private sessionId: string;
  private sessionFile: string;
  private messageCount: number = 0;
  private startTime: Date;
  private initialized: boolean = false;

  // Log rotation and cleanup configuration
  private maxLogFiles: number;
  private maxLogAge: number;
  private maxLogSize: number;
  private enableRotation: boolean;

  constructor(options: {
    outputDir?: string;
    maxLogFiles?: number;
    maxLogAge?: number;
    maxLogSize?: number;
    enableRotation?: boolean;
  } = {}) {
    // Default to .logs directory in extension root
    this.logDir = options.outputDir || path.join(__dirname, '../../.logs');
    this.sessionId = this.generateSessionId();
    // Use timestamped filename
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');
    this.sessionFile = path.join(this.logDir, `orchestrator-${timestamp}.log`);
    this.startTime = new Date();

    // Log rotation and cleanup configuration
    this.maxLogFiles = options.maxLogFiles || 5; // Keep max 5 backup log files
    this.maxLogAge = options.maxLogAge || 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB per log file
    this.enableRotation = options.enableRotation !== false; // Default to true
  }

  /**
   * Generate a unique session ID with timestamp
   */
  private generateSessionId(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  /**
   * Initialize the logger and create necessary directories
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create logs directory if it doesn't exist
      await fs.mkdir(this.logDir, { recursive: true });

      // Create backup directory
      const backupDir = path.join(this.logDir, 'backup');
      await fs.mkdir(backupDir, { recursive: true });

      // Move ALL existing logs to backup before starting new session
      await this.moveAllLogsToBackup();

      // Perform cleanup of old logs before starting
      if (this.enableRotation) {
        await this.performMaintenance();
      }

      // Write session header
      const header = this.formatSessionHeader();
      await fs.writeFile(this.sessionFile, header, 'utf8');

      this.initialized = true;
      console.log(`📝 File logger initialized: ${this.sessionFile}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to initialize file logger: ${message}`);
      throw error;
    }
  }

  /**
   * Format the session header
   */
  private formatSessionHeader(): string {
    return `${'='.repeat(80)}
VSCODE ORCHESTRATOR SESSION LOG
Session ID: ${this.sessionId}
Start Time: ${this.startTime.toISOString()}
${'='.repeat(80)}

`;
  }

  /**
   * Log a message with level and context
   */
  async log(level: string, message: string, context: any = {}): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if log rotation is needed before writing
    await this.checkLogRotation();

    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      formattedMessage += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    formattedMessage += '\n';

    try {
      await fs.appendFile(this.sessionFile, formattedMessage, 'utf8');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to log message: ${msg}`);
    }
  }

  /**
   * Log session summary at the end
   */
  async logSummary(summary: Record<string, any> = {}): Promise<void> {
    if (!this.initialized) return;

    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    const formattedSummary = `
${'='.repeat(80)}
SESSION SUMMARY
${'='.repeat(80)}
End Time: ${endTime.toISOString()}
Duration: ${this.formatDuration(duration)}
Total Messages: ${this.messageCount}
${Object.entries(summary).map(([key, value]) => `${key}: ${value}`).join('\n')}
${'='.repeat(80)}
`;

    try {
      await fs.appendFile(this.sessionFile, formattedSummary, 'utf8');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to log summary: ${msg}`);
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get the session file path
   */
  getSessionFile(): string {
    return this.sessionFile;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Move ALL log files from .logs/ to .logs/backup/
   */
  private async moveAllLogsToBackup(): Promise<void> {
    try {
      const backupDir = path.join(this.logDir, 'backup');

      // Get all .log files in the root logs directory
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file =>
        file.endsWith('.log') && file !== 'backup'
      );

      if (logFiles.length === 0) {
        return;
      }

      // Move each log file to backup - just move them as-is
      for (const file of logFiles) {
        try {
          const filePath = path.join(this.logDir, file);
          const backupFile = path.join(backupDir, file);

          await fs.rename(filePath, backupFile);
          console.log(`📝 Moved ${file} to backup`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Failed to move ${file} to backup: ${msg}`);
          // Try to delete if move fails
          try {
            await fs.unlink(path.join(this.logDir, file));
          } catch {
            // Ignore
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to move logs to backup: ${msg}`);
    }
  }

  /**
   * Get all backup log files, sorted by modification time (newest first)
   */
  private async getLogFiles(): Promise<Array<{
    name: string;
    path: string;
    mtime: Date;
    size: number;
    age: number;
  }>> {
    try {
      const backupDir = path.join(this.logDir, 'backup');
      const files = await fs.readdir(backupDir);
      const logFiles = files.filter(file => file.endsWith('.log'));

      // Get file stats and sort by modification time (newest first)
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime,
            size: stats.size,
            age: Date.now() - stats.mtime.getTime()
          };
        })
      );

      return fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to get log files: ${msg}`);
      return [];
    }
  }

  /**
   * Clean up old log files based on age and count limits
   */
  private async cleanupOldLogs(): Promise<void> {
    if (!this.enableRotation) return;

    try {
      const logFiles = await this.getLogFiles();
      const filesToDelete = [];

      // Mark files for deletion based on age limit
      for (const file of logFiles) {
        if (file.age > this.maxLogAge) {
          filesToDelete.push(file);
        }
      }

      // Mark additional files for deletion if we exceed the max count
      const remainingFiles = logFiles.filter(f => !filesToDelete.includes(f));
      if (remainingFiles.length > this.maxLogFiles) {
        const excessFiles = remainingFiles.slice(this.maxLogFiles);
        filesToDelete.push(...excessFiles);
      }

      // Delete the marked files
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`📝 Cleaned up old log file: ${file.name} (${this.formatDuration(file.age)} old)`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Failed to delete log file ${file.name}: ${msg}`);
        }
      }

      if (filesToDelete.length > 0) {
        console.log(`📝 Log cleanup complete: removed ${filesToDelete.length} old log files`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to cleanup logs: ${msg}`);
    }
  }

  /**
   * Check if current log file needs rotation due to size
   */
  private async checkLogRotation(): Promise<void> {
    if (!this.enableRotation || !this.initialized) return;

    try {
      const stats = await fs.stat(this.sessionFile);
      if (stats.size > this.maxLogSize) {
        await this.rotateCurrentLog();
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Rotate the current log file if it gets too large
   */
  private async rotateCurrentLog(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
      const rotatedFile = path.join(this.logDir, `orchestrator-${this.sessionId}-rotated-${timestamp}.log`);

      // Move current log to rotated name
      await fs.rename(this.sessionFile, rotatedFile);

      // Create new log file with header
      const header = this.formatSessionHeader();
      await fs.writeFile(this.sessionFile, header, 'utf8');

      console.log(`📝 Log rotated: ${path.basename(rotatedFile)} (size limit exceeded)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to rotate log: ${msg}`);
    }
  }

  /**
   * Perform cleanup and log statistics
   */
  private async performMaintenance(): Promise<void> {
    if (!this.enableRotation) return;

    try {
      await this.cleanupOldLogs();

      const logFiles = await this.getLogFiles();
      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      console.log(`📝 Log maintenance complete: ${logFiles.length} files, ${totalSizeMB}MB total`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to perform log maintenance: ${msg}`);
    }
  }

  /**
   * Close the logger
   */
  close(): void {
    this.initialized = false;
  }
}
