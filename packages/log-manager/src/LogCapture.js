import { EventEmitter } from 'events';
import { Tail } from 'tail';
import fs from 'fs';
import { Readable } from 'stream';

/**
 * Captures logs from various sources
 */
export class LogCapture extends EventEmitter {
  constructor() {
    super();
    this.sources = new Map();
    this.buffers = new Map();
    this.tails = new Map();
  }

  /**
   * Capture logs from a stream
   */
  captureStream(sourceId, stream, options = {}) {
    const {
      type = 'stdout',
      bufferSize = 1000,
      encoding = 'utf8'
    } = options;

    if (this.sources.has(sourceId)) {
      throw new Error(`Source ${sourceId} already being captured`);
    }

    const buffer = [];
    const sourceInfo = {
      id: sourceId,
      type: 'stream',
      streamType: type,
      startTime: new Date(),
      lineCount: 0,
      byteCount: 0
    };

    // Handle readable stream
    if (stream instanceof Readable) {
      stream.setEncoding(encoding);
      
      stream.on('data', (chunk) => {
        const timestamp = new Date();
        const lines = chunk.split('\n').filter(line => line.length > 0);
        
        lines.forEach(line => {
          const logEntry = {
            sourceId,
            timestamp,
            type,
            level: this.detectLogLevel(line),
            message: line,
            raw: line
          };
          
          // Add to buffer
          buffer.push(logEntry);
          if (buffer.length > bufferSize) {
            buffer.shift();
          }
          
          // Update stats
          sourceInfo.lineCount++;
          sourceInfo.byteCount += line.length;
          
          // Emit log event
          this.emit('log', logEntry);
        });
      });

      stream.on('error', (error) => {
        this.emit('error', { sourceId, error });
      });

      stream.on('end', () => {
        sourceInfo.endTime = new Date();
        this.emit('source-end', { sourceId });
      });
    }

    this.sources.set(sourceId, sourceInfo);
    this.buffers.set(sourceId, buffer);

    return {
      sourceId,
      status: 'capturing'
    };
  }

  /**
   * Capture logs from a file
   */
  captureFile(sourceId, filePath, options = {}) {
    const {
      fromBeginning = false,
      follow = true,
      bufferSize = 1000
    } = options;

    if (this.sources.has(sourceId)) {
      throw new Error(`Source ${sourceId} already being captured`);
    }

    const buffer = [];
    const sourceInfo = {
      id: sourceId,
      type: 'file',
      filePath,
      startTime: new Date(),
      lineCount: 0,
      byteCount: 0
    };

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Create tail instance
      const tail = new Tail(filePath, {
        fromBeginning,
        follow,
        logger: {
          info: () => {},
          error: (error) => this.emit('error', { sourceId, error })
        }
      });

      tail.on('line', (line) => {
        const timestamp = new Date();
        const logEntry = {
          sourceId,
          timestamp,
          type: 'file',
          level: this.detectLogLevel(line),
          message: line,
          raw: line,
          file: filePath
        };

        // Add to buffer
        buffer.push(logEntry);
        if (buffer.length > bufferSize) {
          buffer.shift();
        }

        // Update stats
        sourceInfo.lineCount++;
        sourceInfo.byteCount += line.length;

        // Emit log event
        this.emit('log', logEntry);
      });

      tail.on('error', (error) => {
        this.emit('error', { sourceId, error });
      });

      // Start watching
      tail.watch();

      this.sources.set(sourceId, sourceInfo);
      this.buffers.set(sourceId, buffer);
      this.tails.set(sourceId, tail);

      return {
        sourceId,
        status: 'capturing',
        filePath
      };
    } catch (error) {
      throw new Error(`Failed to capture file: ${error.message}`);
    }
  }

  /**
   * Capture logs from a process
   */
  captureProcess(sourceId, processInfo, options = {}) {
    const { pid, stdout, stderr } = processInfo;
    const results = [];

    if (stdout) {
      const stdoutResult = this.captureStream(`${sourceId}-stdout`, stdout, {
        ...options,
        type: 'stdout'
      });
      results.push(stdoutResult);
    }

    if (stderr) {
      const stderrResult = this.captureStream(`${sourceId}-stderr`, stderr, {
        ...options,
        type: 'stderr'
      });
      results.push(stderrResult);
    }

    // Create combined source info
    const sourceInfo = {
      id: sourceId,
      type: 'process',
      pid,
      streams: results.map(r => r.sourceId),
      startTime: new Date()
    };

    this.sources.set(sourceId, sourceInfo);

    return {
      sourceId,
      status: 'capturing',
      streams: results
    };
  }

  /**
   * Stop capturing from a source
   */
  stopCapture(sourceId) {
    const sourceInfo = this.sources.get(sourceId);
    if (!sourceInfo) {
      throw new Error(`Source ${sourceId} not found`);
    }

    // Handle file tails
    if (this.tails.has(sourceId)) {
      const tail = this.tails.get(sourceId);
      tail.unwatch();
      this.tails.delete(sourceId);
    }

    // Handle process with multiple streams
    if (sourceInfo.type === 'process' && sourceInfo.streams) {
      sourceInfo.streams.forEach(streamId => {
        this.sources.delete(streamId);
        this.buffers.delete(streamId);
      });
    }

    sourceInfo.endTime = new Date();
    this.emit('source-stopped', { sourceId });

    return {
      sourceId,
      status: 'stopped',
      duration: sourceInfo.endTime - sourceInfo.startTime
    };
  }

  /**
   * Get buffered logs for a source
   */
  getBufferedLogs(sourceId, options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    const buffer = this.buffers.get(sourceId);
    if (!buffer) {
      throw new Error(`No buffer found for source ${sourceId}`);
    }

    const logs = buffer.slice(offset, offset + limit);
    
    return {
      sourceId,
      logs,
      total: buffer.length,
      offset,
      limit
    };
  }

  /**
   * Get all logs from all sources
   */
  getAllLogs(options = {}) {
    const { limit = 100, offset = 0 } = options;
    const allLogs = [];

    // Combine logs from all buffers
    for (const [sourceId, buffer] of this.buffers) {
      allLogs.push(...buffer.map(log => ({ ...log, sourceId })));
    }

    // Sort by timestamp
    allLogs.sort((a, b) => a.timestamp - b.timestamp);

    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total: allLogs.length,
      offset,
      limit,
      sources: Array.from(this.sources.keys())
    };
  }

  /**
   * Clear buffer for a source
   */
  clearBuffer(sourceId) {
    const buffer = this.buffers.get(sourceId);
    if (!buffer) {
      throw new Error(`No buffer found for source ${sourceId}`);
    }

    buffer.length = 0;

    return {
      sourceId,
      status: 'cleared'
    };
  }

  /**
   * Detect log level from message
   */
  detectLogLevel(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('error') || lowerMessage.includes('err:')) {
      return 'error';
    }
    if (lowerMessage.includes('warn') || lowerMessage.includes('warning:')) {
      return 'warn';
    }
    if (lowerMessage.includes('info:') || lowerMessage.includes('information:')) {
      return 'info';
    }
    if (lowerMessage.includes('debug:') || lowerMessage.includes('dbg:')) {
      return 'debug';
    }
    if (lowerMessage.includes('trace:')) {
      return 'trace';
    }
    
    return 'info'; // Default level
  }

  /**
   * Get source information
   */
  getSourceInfo(sourceId) {
    const sourceInfo = this.sources.get(sourceId);
    if (!sourceInfo) {
      return null;
    }

    const bufferSize = this.buffers.has(sourceId) ? this.buffers.get(sourceId).length : 0;

    return {
      ...sourceInfo,
      bufferSize,
      isActive: !sourceInfo.endTime
    };
  }

  /**
   * List all sources
   */
  listSources() {
    const sources = [];
    
    for (const [id, info] of this.sources) {
      sources.push(this.getSourceInfo(id));
    }

    return sources;
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    // Stop all file tails
    for (const [sourceId, tail] of this.tails) {
      tail.unwatch();
    }

    // Clear all data
    this.sources.clear();
    this.buffers.clear();
    this.tails.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}