/**
 * SessionLogger - Simple file-based logging for ROMA agent sessions
 * Logs all LLM prompts and responses to a single file per session
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class SessionLogger {
  constructor(options = {}) {
    // Handle both old string constructor and new options object
    const logDir = typeof options === 'string' ? options : options.outputDir;
    
    // Default to logs directory in package root
    this.logDir = logDir || path.join(__dirname, '../../logs');
    this.sessionId = this.generateSessionId();
    this.sessionFile = path.join(this.logDir, `session-${this.sessionId}.log`);
    this.interactionCount = 0;
    this.startTime = new Date();
    this.initialized = false;
    
    // Log rotation and cleanup configuration
    this.maxLogFiles = options.maxLogFiles || 50; // Keep max 50 log files
    this.maxLogAge = options.maxLogAge || 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB per log file
    this.enableRotation = options.enableRotation !== false; // Default to true
  }

  /**
   * Generate a unique session ID with timestamp
   */
  generateSessionId() {
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
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create logs directory if it doesn't exist
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Perform cleanup of old logs before starting
      if (this.enableRotation) {
        await this.performMaintenance();
      }
      
      // Write session header
      const header = this.formatSessionHeader();
      await fs.writeFile(this.sessionFile, header, 'utf8');
      
      this.initialized = true;
      console.log(`📝 Session logger initialized: ${this.sessionFile}`);
    } catch (error) {
      console.error(`Failed to initialize session logger: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format the session header
   */
  formatSessionHeader() {
    return `${'='.repeat(80)}
ROMA AGENT SESSION LOG
Session ID: ${this.sessionId}
Start Time: ${this.startTime.toISOString()}
${'='.repeat(80)}

`;
  }

  /**
   * Log an interaction (prompt and response)
   */
  async logInteraction(task, interactionType, prompt, response, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if log rotation is needed before writing
    await this.checkLogRotation();

    this.interactionCount++;
    
    const entry = {
      interactionNumber: this.interactionCount,
      timestamp: new Date().toISOString(),
      interactionType,
      taskId: task?.id || 'unknown',
      taskDescription: task?.description || 'No description',
      taskDepth: task?.depth || 0,
      taskStatus: task?.status || 'unknown',
      prompt,
      response,
      metadata
    };

    const formattedEntry = this.formatInteraction(entry);
    
    try {
      await fs.appendFile(this.sessionFile, formattedEntry, 'utf8');
    } catch (error) {
      console.error(`Failed to log interaction: ${error.message}`);
      // Don't throw - logging shouldn't break execution
    }

    return entry;
  }

  /**
   * Format an interaction entry for the log file
   */
  formatInteraction(entry) {
    let formatted = `
${'='.repeat(80)}
INTERACTION #${entry.interactionNumber}
${'='.repeat(80)}
Timestamp: ${entry.timestamp}
Type: ${entry.interactionType}
Task ID: ${entry.taskId}
Task: ${entry.taskDescription}
Depth: ${entry.taskDepth}
Status: ${entry.taskStatus}
`;

    // Add metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += `Metadata: ${JSON.stringify(entry.metadata, null, 2)}\n`;
    }

    formatted += `
${'- '.repeat(40)}
PROMPT:
${'- '.repeat(40)}
${entry.prompt}

${'- '.repeat(40)}
RESPONSE:
${'- '.repeat(40)}
${entry.response}

`;

    // Try to parse and format JSON response
    try {
      const parsed = JSON.parse(entry.response);
      formatted += `${'- '.repeat(40)}
PARSED RESPONSE:
${'- '.repeat(40)}
${JSON.stringify(parsed, null, 2)}

`;
    } catch {
      // Not JSON, that's fine
    }

    return formatted;
  }

  /**
   * Log a simple message (not an interaction)
   */
  async logMessage(level, message, context = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const timestamp = new Date().toISOString();
    let formattedMessage = `
[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (Object.keys(context).length > 0) {
      formattedMessage += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    formattedMessage += '\n';

    try {
      await fs.appendFile(this.sessionFile, formattedMessage, 'utf8');
    } catch (error) {
      console.error(`Failed to log message: ${error.message}`);
    }
  }

  /**
   * Log session summary at the end
   */
  async logSummary(summary = {}) {
    if (!this.initialized) return;

    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    const formattedSummary = `
${'='.repeat(80)}
SESSION SUMMARY
${'='.repeat(80)}
End Time: ${endTime.toISOString()}
Duration: ${this.formatDuration(duration)}
Total Interactions: ${this.interactionCount}
${Object.entries(summary).map(([key, value]) => `${key}: ${value}`).join('\n')}
${'='.repeat(80)}
`;

    try {
      await fs.appendFile(this.sessionFile, formattedSummary, 'utf8');
    } catch (error) {
      console.error(`Failed to log summary: ${error.message}`);
    }
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
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
  getSessionFile() {
    return this.sessionFile;
  }

  /**
   * Get the session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Get all log files in the log directory, sorted by modification time (newest first)
   */
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('session-') && file.endsWith('.log'));
      
      // Get file stats and sort by modification time (newest first)
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(this.logDir, file);
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
      
      return fileStats.sort((a, b) => b.mtime - a.mtime);
    } catch (error) {
      console.error(`Failed to get log files: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean up old log files based on age and count limits
   */
  async cleanupOldLogs() {
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
          console.error(`Failed to delete log file ${file.name}: ${error.message}`);
        }
      }

      if (filesToDelete.length > 0) {
        console.log(`📝 Log cleanup complete: removed ${filesToDelete.length} old log files`);
      }
    } catch (error) {
      console.error(`Failed to cleanup logs: ${error.message}`);
    }
  }

  /**
   * Check if current log file needs rotation due to size
   */
  async checkLogRotation() {
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
  async rotateCurrentLog() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
      const rotatedFile = path.join(this.logDir, `session-${this.sessionId}-rotated-${timestamp}.log`);
      
      // Move current log to rotated name
      await fs.rename(this.sessionFile, rotatedFile);
      
      // Create new log file with header
      const header = this.formatSessionHeader();
      await fs.writeFile(this.sessionFile, header, 'utf8');
      
      console.log(`📝 Log rotated: ${path.basename(rotatedFile)} (size limit exceeded)`);
    } catch (error) {
      console.error(`Failed to rotate log: ${error.message}`);
    }
  }

  /**
   * Perform cleanup and log statistics
   */
  async performMaintenance() {
    if (!this.enableRotation) return;

    try {
      await this.cleanupOldLogs();
      
      const logFiles = await this.getLogFiles();
      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      console.log(`📝 Log maintenance complete: ${logFiles.length} files, ${totalSizeMB}MB total`);
    } catch (error) {
      console.error(`Failed to perform log maintenance: ${error.message}`);
    }
  }
}