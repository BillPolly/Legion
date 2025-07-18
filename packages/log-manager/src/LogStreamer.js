import { EventEmitter } from 'events';
import { Readable } from 'stream';

/**
 * Real-time log streaming capabilities
 */
export class LogStreamer extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map();
    this.filters = new Map();
    this.subscribers = new Map();
  }

  /**
   * Create a log stream
   */
  createStream(streamId, options = {}) {
    const {
      sources = [],
      levels = ['error', 'warn', 'info', 'debug', 'trace'],
      filter = null,
      realtime = true,
      bufferSize = 100
    } = options;

    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    const streamInfo = {
      id: streamId,
      sources: new Set(sources),
      levels: new Set(levels),
      filter,
      realtime,
      buffer: [],
      bufferSize,
      subscribers: new Set(),
      stats: {
        totalLogs: 0,
        filteredLogs: 0,
        lastLog: null
      },
      createdAt: new Date()
    };

    this.streams.set(streamId, streamInfo);

    // Create readable stream
    const readableStream = new Readable({
      objectMode: true,
      read() {
        // Stream will be pushed to
      }
    });

    streamInfo.readableStream = readableStream;

    return {
      streamId,
      stream: readableStream,
      status: 'created'
    };
  }

  /**
   * Add log to streams
   */
  async processLog(logEntry) {
    for (const [streamId, streamInfo] of this.streams) {
      // Check if log matches stream criteria
      if (this.matchesStreamCriteria(logEntry, streamInfo)) {
        streamInfo.stats.totalLogs++;

        // Apply additional filter if present
        if (!streamInfo.filter || this.matchesFilter(logEntry, streamInfo.filter)) {
          streamInfo.stats.filteredLogs++;
          streamInfo.stats.lastLog = new Date();

          // Add to buffer
          streamInfo.buffer.push(logEntry);
          if (streamInfo.buffer.length > streamInfo.bufferSize) {
            streamInfo.buffer.shift();
          }

          // Push to readable stream if realtime
          if (streamInfo.realtime && streamInfo.readableStream) {
            streamInfo.readableStream.push(logEntry);
          }

          // Emit to subscribers
          this.emit(`stream:${streamId}`, logEntry);

          // Notify specific subscribers
          for (const subscriberId of streamInfo.subscribers) {
            const subscriber = this.subscribers.get(subscriberId);
            if (subscriber && subscriber.callback) {
              try {
                await subscriber.callback(logEntry);
              } catch (error) {
                console.error(`Subscriber ${subscriberId} error:`, error);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Check if log matches stream criteria
   */
  matchesStreamCriteria(logEntry, streamInfo) {
    // Check source
    if (streamInfo.sources.size > 0 && !streamInfo.sources.has(logEntry.sourceId)) {
      return false;
    }

    // Check level
    if (streamInfo.levels.size > 0 && !streamInfo.levels.has(logEntry.level)) {
      return false;
    }

    return true;
  }

  /**
   * Check if log matches filter
   */
  matchesFilter(logEntry, filter) {
    if (typeof filter === 'function') {
      return filter(logEntry);
    }

    if (typeof filter === 'object') {
      // Simple object matching
      for (const [key, value] of Object.entries(filter)) {
        if (logEntry[key] !== value) {
          return false;
        }
      }
      return true;
    }

    if (typeof filter === 'string') {
      // Text search in message
      return logEntry.message.includes(filter);
    }

    return true;
  }

  /**
   * Subscribe to a stream
   */
  subscribe(streamId, subscriberId, callback) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    streamInfo.subscribers.add(subscriberId);
    
    this.subscribers.set(subscriberId, {
      id: subscriberId,
      streamId,
      callback,
      subscribedAt: new Date()
    });

    return {
      subscriberId,
      streamId,
      status: 'subscribed'
    };
  }

  /**
   * Unsubscribe from a stream
   */
  unsubscribe(subscriberId) {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      throw new Error(`Subscriber ${subscriberId} not found`);
    }

    const streamInfo = this.streams.get(subscriber.streamId);
    if (streamInfo) {
      streamInfo.subscribers.delete(subscriberId);
    }

    this.subscribers.delete(subscriberId);

    return {
      subscriberId,
      status: 'unsubscribed'
    };
  }

  /**
   * Update stream configuration
   */
  updateStream(streamId, updates = {}) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const { sources, levels, filter } = updates;

    if (sources !== undefined) {
      streamInfo.sources = new Set(sources);
    }

    if (levels !== undefined) {
      streamInfo.levels = new Set(levels);
    }

    if (filter !== undefined) {
      streamInfo.filter = filter;
    }

    return {
      streamId,
      status: 'updated',
      sources: Array.from(streamInfo.sources),
      levels: Array.from(streamInfo.levels)
    };
  }

  /**
   * Get stream buffer
   */
  getStreamBuffer(streamId, options = {}) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const { limit = 100, offset = 0 } = options;
    const logs = streamInfo.buffer.slice(offset, offset + limit);

    return {
      streamId,
      logs,
      total: streamInfo.buffer.length,
      offset,
      limit
    };
  }

  /**
   * Get stream statistics
   */
  getStreamStats(streamId) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const duration = Date.now() - streamInfo.createdAt.getTime();
    const logsPerSecond = streamInfo.stats.totalLogs / (duration / 1000);

    return {
      streamId,
      sources: Array.from(streamInfo.sources),
      levels: Array.from(streamInfo.levels),
      ...streamInfo.stats,
      subscriberCount: streamInfo.subscribers.size,
      bufferUtilization: (streamInfo.buffer.length / streamInfo.bufferSize) * 100,
      logsPerSecond,
      uptime: duration,
      createdAt: streamInfo.createdAt
    };
  }

  /**
   * List all streams
   */
  listStreams() {
    const streams = [];
    
    for (const [id, streamInfo] of this.streams) {
      streams.push({
        id,
        sources: Array.from(streamInfo.sources),
        levels: Array.from(streamInfo.levels),
        realtime: streamInfo.realtime,
        stats: this.getStreamStats(id)
      });
    }

    return streams;
  }

  /**
   * Close a stream
   */
  closeStream(streamId) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    // End readable stream
    if (streamInfo.readableStream) {
      streamInfo.readableStream.push(null);
    }

    // Remove all subscribers
    for (const subscriberId of streamInfo.subscribers) {
      this.subscribers.delete(subscriberId);
    }

    // Remove stream
    this.streams.delete(streamId);

    // Remove event listeners
    this.removeAllListeners(`stream:${streamId}`);

    return {
      streamId,
      status: 'closed'
    };
  }

  /**
   * Create a WebSocket-compatible stream
   */
  createWebSocketStream(streamId, ws, options = {}) {
    const { format = 'json' } = options;

    // Subscribe to stream
    const subscriberId = `ws-${streamId}-${Date.now()}`;
    
    const callback = (logEntry) => {
      if (ws.readyState === ws.OPEN) {
        let message;
        
        switch (format) {
          case 'json':
            message = JSON.stringify(logEntry);
            break;
          case 'text':
            message = `[${new Date(logEntry.timestamp).toISOString()}] ${logEntry.level}: ${logEntry.message}`;
            break;
          default:
            message = JSON.stringify(logEntry);
        }
        
        ws.send(message);
      }
    };

    this.subscribe(streamId, subscriberId, callback);

    // Handle WebSocket close
    ws.on('close', () => {
      this.unsubscribe(subscriberId);
    });

    return {
      streamId,
      subscriberId,
      format
    };
  }

  /**
   * Create a Server-Sent Events (SSE) stream
   */
  createSSEStream(streamId, res, options = {}) {
    const { format = 'json' } = options;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial connection message
    res.write(`event: connected\ndata: {"streamId":"${streamId}"}\n\n`);

    // Subscribe to stream
    const subscriberId = `sse-${streamId}-${Date.now()}`;
    
    const callback = (logEntry) => {
      let data;
      
      switch (format) {
        case 'json':
          data = JSON.stringify(logEntry);
          break;
        case 'text':
          data = `[${new Date(logEntry.timestamp).toISOString()}] ${logEntry.level}: ${logEntry.message}`;
          break;
        default:
          data = JSON.stringify(logEntry);
      }
      
      res.write(`event: log\ndata: ${data}\n\n`);
    };

    this.subscribe(streamId, subscriberId, callback);

    // Handle client disconnect
    res.on('close', () => {
      this.unsubscribe(subscriberId);
    });

    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(heartbeat);
    });

    return {
      streamId,
      subscriberId,
      format
    };
  }

  /**
   * Apply backpressure handling
   */
  applyBackpressure(streamId, options = {}) {
    const streamInfo = this.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const { highWaterMark = 1000, lowWaterMark = 100 } = options;

    streamInfo.backpressure = {
      enabled: true,
      highWaterMark,
      lowWaterMark,
      paused: false
    };

    // Monitor buffer size
    if (streamInfo.buffer.length > highWaterMark) {
      streamInfo.backpressure.paused = true;
      this.emit(`backpressure:${streamId}`, { paused: true });
    }

    return {
      streamId,
      backpressure: streamInfo.backpressure
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    // Close all streams
    for (const streamId of this.streams.keys()) {
      this.closeStream(streamId);
    }

    // Clear all data
    this.streams.clear();
    this.filters.clear();
    this.subscribers.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}