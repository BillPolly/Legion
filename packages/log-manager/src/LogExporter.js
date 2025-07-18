import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * Exports logs in various formats
 */
export class LogExporter {
  constructor() {
    this.exportFormats = ['json', 'csv', 'txt', 'html', 'jsonl'];
  }

  /**
   * Export logs to file
   */
  async exportLogs(logs, outputPath, options = {}) {
    const {
      format = 'json',
      includeMetadata = true,
      pretty = true,
      compress = false
    } = options;

    if (!this.exportFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Add appropriate extension if not present
    const ext = path.extname(outputPath);
    if (!ext) {
      outputPath += `.${format}`;
    }

    // Export based on format
    let exportResult;
    switch (format) {
      case 'json':
        exportResult = await this.exportJSON(logs, outputPath, { pretty, includeMetadata });
        break;
      case 'jsonl':
        exportResult = await this.exportJSONL(logs, outputPath, { includeMetadata });
        break;
      case 'csv':
        exportResult = await this.exportCSV(logs, outputPath, { includeMetadata });
        break;
      case 'txt':
        exportResult = await this.exportText(logs, outputPath, { includeMetadata });
        break;
      case 'html':
        exportResult = await this.exportHTML(logs, outputPath, { includeMetadata });
        break;
    }

    return {
      format,
      outputPath,
      logCount: logs.length,
      fileSize: exportResult.size,
      ...exportResult
    };
  }

  /**
   * Export as JSON
   */
  async exportJSON(logs, outputPath, options = {}) {
    const { pretty = true, includeMetadata = true } = options;

    const exportData = {
      exportTime: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs
    };

    if (includeMetadata) {
      exportData.metadata = this.generateMetadata(logs);
    }

    const jsonContent = pretty 
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    await fs.writeFile(outputPath, jsonContent, 'utf8');

    const stats = await fs.stat(outputPath);
    return {
      size: stats.size,
      lines: logs.length
    };
  }

  /**
   * Export as JSON Lines (JSONL)
   */
  async exportJSONL(logs, outputPath, options = {}) {
    const { includeMetadata = true } = options;

    const writeStream = createWriteStream(outputPath);
    let lineCount = 0;

    // Write metadata line if requested
    if (includeMetadata) {
      const metadata = {
        type: 'metadata',
        exportTime: new Date().toISOString(),
        totalLogs: logs.length,
        ...this.generateMetadata(logs)
      };
      writeStream.write(JSON.stringify(metadata) + '\n');
      lineCount++;
    }

    // Write each log as a line
    for (const log of logs) {
      writeStream.write(JSON.stringify(log) + '\n');
      lineCount++;
    }

    await new Promise((resolve, reject) => {
      writeStream.end((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const stats = await fs.stat(outputPath);
    return {
      size: stats.size,
      lines: lineCount
    };
  }

  /**
   * Export as CSV
   */
  async exportCSV(logs, outputPath, options = {}) {
    const { includeMetadata = true } = options;

    // Define CSV columns
    const columns = [
      'timestamp',
      'level',
      'sourceId',
      'message',
      'type',
      'file'
    ];

    const lines = [];

    // Add metadata as comments if requested
    if (includeMetadata) {
      const metadata = this.generateMetadata(logs);
      lines.push(`# Export Time: ${new Date().toISOString()}`);
      lines.push(`# Total Logs: ${logs.length}`);
      lines.push(`# Time Range: ${metadata.timeRange.start} to ${metadata.timeRange.end}`);
      lines.push('');
    }

    // Add header
    lines.push(columns.join(','));

    // Add data rows
    for (const log of logs) {
      const row = columns.map(col => {
        let value = log[col] || '';
        
        // Format timestamp
        if (col === 'timestamp' && value) {
          value = new Date(value).toISOString();
        }
        
        // Escape CSV values
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      });
      
      lines.push(row.join(','));
    }

    await fs.writeFile(outputPath, lines.join('\n'), 'utf8');

    const stats = await fs.stat(outputPath);
    return {
      size: stats.size,
      lines: lines.length
    };
  }

  /**
   * Export as plain text
   */
  async exportText(logs, outputPath, options = {}) {
    const { includeMetadata = true } = options;

    const lines = [];

    // Add metadata header if requested
    if (includeMetadata) {
      const metadata = this.generateMetadata(logs);
      lines.push('='.repeat(80));
      lines.push('LOG EXPORT');
      lines.push('='.repeat(80));
      lines.push(`Export Time: ${new Date().toISOString()}`);
      lines.push(`Total Logs: ${logs.length}`);
      lines.push(`Time Range: ${metadata.timeRange.start} to ${metadata.timeRange.end}`);
      lines.push('='.repeat(80));
      lines.push('');
    }

    // Add logs
    for (const log of logs) {
      const timestamp = new Date(log.timestamp).toISOString();
      const level = (log.level || 'info').toUpperCase().padEnd(5);
      const source = log.sourceId || 'unknown';
      
      lines.push(`[${timestamp}] ${level} (${source})`);
      lines.push(log.message);
      
      // Add extra details if available
      if (log.file) {
        lines.push(`  File: ${log.file}`);
      }
      
      lines.push(''); // Empty line between logs
    }

    await fs.writeFile(outputPath, lines.join('\n'), 'utf8');

    const stats = await fs.stat(outputPath);
    return {
      size: stats.size,
      lines: lines.length
    };
  }

  /**
   * Export as HTML
   */
  async exportHTML(logs, outputPath, options = {}) {
    const { includeMetadata = true } = options;

    const metadata = includeMetadata ? this.generateMetadata(logs) : null;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Log Export - ${new Date().toISOString()}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin-top: 0;
      color: #333;
    }
    .metadata {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .metadata dl {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      margin: 0;
    }
    .metadata dt {
      font-weight: bold;
      color: #666;
    }
    .metadata dd {
      margin: 0;
      color: #333;
    }
    .logs {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
    }
    .log-entry {
      border-bottom: 1px solid #eee;
      padding: 10px 0;
    }
    .log-entry:last-child {
      border-bottom: none;
    }
    .log-header {
      display: flex;
      gap: 10px;
      margin-bottom: 5px;
    }
    .log-timestamp {
      color: #666;
    }
    .log-level {
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }
    .level-error { background: #fee; color: #c00; }
    .level-warn { background: #ffeaa7; color: #d63031; }
    .level-info { background: #e3f2fd; color: #1976d2; }
    .level-debug { background: #f3e5f5; color: #7b1fa2; }
    .log-source {
      color: #999;
      font-size: 11px;
    }
    .log-message {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .stats {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Log Export</h1>
    ${metadata ? `
    <div class="metadata">
      <dl>
        <dt>Export Time:</dt>
        <dd>${new Date().toISOString()}</dd>
        <dt>Total Logs:</dt>
        <dd>${logs.length}</dd>
        <dt>Time Range:</dt>
        <dd>${metadata.timeRange.start} to ${metadata.timeRange.end}</dd>
        <dt>Error Count:</dt>
        <dd>${metadata.errorCount} (${metadata.errorRate.toFixed(1)}%)</dd>
        <dt>Sources:</dt>
        <dd>${metadata.sources.join(', ')}</dd>
      </dl>
    </div>
    ` : ''}
    <div class="logs">
      ${logs.map(log => `
        <div class="log-entry">
          <div class="log-header">
            <span class="log-timestamp">${new Date(log.timestamp).toISOString()}</span>
            <span class="log-level level-${log.level || 'info'}">${(log.level || 'info').toUpperCase()}</span>
            <span class="log-source">${log.sourceId || 'unknown'}</span>
          </div>
          <div class="log-message">${this.escapeHtml(log.message)}</div>
        </div>
      `).join('')}
    </div>
    <div class="stats">
      Exported ${logs.length} logs
    </div>
  </div>
</body>
</html>`;

    await fs.writeFile(outputPath, html, 'utf8');

    const stats = await fs.stat(outputPath);
    return {
      size: stats.size,
      lines: logs.length
    };
  }

  /**
   * Generate metadata for export
   */
  generateMetadata(logs) {
    if (logs.length === 0) {
      return {
        timeRange: { start: null, end: null },
        sources: [],
        errorCount: 0,
        errorRate: 0
      };
    }

    const timestamps = logs.map(log => new Date(log.timestamp));
    const sources = [...new Set(logs.map(log => log.sourceId || 'unknown'))];
    const errorCount = logs.filter(log => log.level === 'error').length;

    return {
      timeRange: {
        start: new Date(Math.min(...timestamps)).toISOString(),
        end: new Date(Math.max(...timestamps)).toISOString()
      },
      sources,
      errorCount,
      errorRate: (errorCount / logs.length) * 100,
      levels: this.countLevels(logs)
    };
  }

  /**
   * Count log levels
   */
  countLevels(logs) {
    const levels = {};
    
    logs.forEach(log => {
      const level = log.level || 'info';
      levels[level] = (levels[level] || 0) + 1;
    });
    
    return levels;
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Create export stream for large datasets
   */
  createExportStream(format, options = {}) {
    switch (format) {
      case 'jsonl':
        return this.createJSONLStream(options);
      case 'csv':
        return this.createCSVStream(options);
      case 'txt':
        return this.createTextStream(options);
      default:
        throw new Error(`Streaming not supported for format: ${format}`);
    }
  }

  /**
   * Create JSONL export stream
   */
  createJSONLStream(options = {}) {
    return new Transform({
      objectMode: true,
      transform(log, encoding, callback) {
        try {
          this.push(JSON.stringify(log) + '\n');
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Create CSV export stream
   */
  createCSVStream(options = {}) {
    let headerWritten = false;
    const columns = ['timestamp', 'level', 'sourceId', 'message'];

    return new Transform({
      objectMode: true,
      transform(log, encoding, callback) {
        try {
          if (!headerWritten) {
            this.push(columns.join(',') + '\n');
            headerWritten = true;
          }

          const row = columns.map(col => {
            let value = log[col] || '';
            if (col === 'timestamp' && value) {
              value = new Date(value).toISOString();
            }
            value = String(value);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });

          this.push(row.join(',') + '\n');
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Create text export stream
   */
  createTextStream(options = {}) {
    return new Transform({
      objectMode: true,
      transform(log, encoding, callback) {
        try {
          const timestamp = new Date(log.timestamp).toISOString();
          const level = (log.level || 'info').toUpperCase().padEnd(5);
          const source = log.sourceId || 'unknown';
          
          this.push(`[${timestamp}] ${level} (${source})\n`);
          this.push(log.message + '\n\n');
          
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }
}