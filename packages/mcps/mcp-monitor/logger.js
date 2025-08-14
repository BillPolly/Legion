import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FileLogger {
  constructor(port = null) {
    this.port = port || 9901;  // Store the port
    this.logDir = path.join(__dirname, 'logs');
    this.backupDir = path.join(this.logDir, 'backup');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 5;
    this.currentLogFile = null;
    this.stream = null;
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Move only logs with same port to backup before starting
    this.moveAllLogsToBackup();
    
    this.initLogFile();
  }
  
  initLogFile() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-').substring(0, 5); // HH-MM
    this.currentLogFile = path.join(this.logDir, `mcp-server-${date}-${time}-${this.port}.log`);
    
    // Create new file (not append) for each server start
    this.stream = fs.createWriteStream(this.currentLogFile, { flags: 'w' });
    
    // Write startup message directly to avoid circular call
    const startupLog = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `MCP Server started - PID: ${process.pid}`
    }) + '\n';
    this.stream.write(startupLog);
  }
  
  write(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Check if we need to rotate
    this.checkRotation();
    
    // Write to file
    if (this.stream) {
      this.stream.write(logLine);
    }
    
    // Also log to stderr for terminal visibility
    if (level === 'error') {
      console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    } else {
      console.error(`[${timestamp}] [${level}] ${message}`);
    }
  }
  
  checkRotation() {
    try {
      const stats = fs.statSync(this.currentLogFile);
      
      // Rotate if file is too large
      if (stats.size > this.maxFileSize) {
        this.rotate();
      }
    } catch (err) {
      // File doesn't exist, create new one
      this.initLogFile();
    }
  }
  
  rotate() {
    // Close current stream
    if (this.stream) {
      this.stream.end();
    }
    
    // Clean up old files
    this.cleanOldLogs();
    
    // Create new log file
    this.initLogFile();
  }
  
  moveAllLogsToBackup() {
    try {
      // Move only logs with matching port to backup when server starts
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('mcp-server-') && f.endsWith(`.log`) && f.includes(`-${this.port}.log`));
      
      files.forEach(f => {
        try {
          const sourcePath = path.join(this.logDir, f);
          const backupPath = path.join(this.backupDir, f);
          
          // If file already exists in backup, add a timestamp to make it unique
          let finalBackupPath = backupPath;
          if (fs.existsSync(backupPath)) {
            const timestamp = Date.now();
            const nameParts = f.split('.');
            nameParts[nameParts.length - 2] += `-${timestamp}`;
            finalBackupPath = path.join(this.backupDir, nameParts.join('.'));
          }
          
          fs.renameSync(sourcePath, finalBackupPath);
          console.error(`[Logger] Moved existing log to backup: ${f}`);
        } catch (err) {
          console.error(`[Logger] Failed to move log ${f} to backup:`, err.message);
        }
      });
    } catch (err) {
      console.error('[Logger] Error moving logs to backup:', err.message);
    }
  }
  
  cleanOldLogs() {
    try {
      // Clean up old backup files if there are too many
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('mcp-server-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by newest first
      
      // Delete old backup files beyond the max limit
      if (backupFiles.length > this.maxFiles * 2) { // Keep more in backup
        const filesToDelete = backupFiles.slice(this.maxFiles * 2);
        filesToDelete.forEach(f => {
          try {
            fs.unlinkSync(f.path);
            console.error(`[Logger] Deleted old backup: ${f.name}`);
          } catch (err) {
            console.error(`[Logger] Failed to delete backup ${f.name}:`, err.message);
          }
        });
      }
    } catch (err) {
      console.error('[Logger] Error cleaning old backups:', err.message);
    }
  }
  
  info(message, meta) {
    this.write('info', message, meta);
  }
  
  error(message, meta) {
    this.write('error', message, meta);
  }
  
  warn(message, meta) {
    this.write('warn', message, meta);
  }
  
  debug(message, meta) {
    this.write('debug', message, meta);
  }
  
  close() {
    if (this.stream) {
      try {
        this.stream.end();
      } catch (err) {
        console.error('[Logger] Error closing stream:', err.message);
      }
    }
  }
}

// Export the class, not a singleton
export default FileLogger;