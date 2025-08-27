/**
 * @fileoverview WebSocketServer - Frontend log streaming server for browser logs
 */

import { EventEmitter } from 'events';
import { WebSocketServer as WSServer } from 'ws';
import { generateId } from '../utils/index.js';
import net from 'net';

export class WebSocketServer extends EventEmitter {
  constructor(logStorage, config = {}) {
    super();
    this.logStorage = logStorage;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.clientInfo = new Map();
    this.startTime = null;
    this.messageStats = {
      total: 0,
      byType: {}
    };
    this.connectionStats = {
      total: 0,
      current: 0
    };
    
    // Configuration with defaults
    this.config = {
      maxConnections: config.maxConnections || 100,
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatTimeout: config.heartbeatTimeout || 60000,
      maxMessageSize: config.maxMessageSize || 1048576, // 1MB
      allowedOrigins: config.allowedOrigins || null,
      rateLimit: config.rateLimit || null,
      ...config
    };
    
    this.heartbeatTimer = null;
  }

  /**
   * Start the WebSocket server
   * @param {number} port - Port to listen on (optional, will auto-allocate)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Start result
   */
  async start(port, options = {}) {
    if (this.isRunning()) {
      throw new Error('WebSocket server is already running');
    }
    
    try {
      // Find available port if not specified
      const actualPort = port || await this.findAvailablePort(8080);
      
      // If retry on fail is disabled and port is in use, fail immediately
      if (options.retryOnFail === false) {
        const inUse = await this.isPortInUse(actualPort);
        if (inUse) {
          return {
            success: false,
            error: 'EADDRINUSE: Port already in use'
          };
        }
      }
      
      // Try to find an available port if the requested one is in use
      const finalPort = await this.findAvailablePort(actualPort);
      
      // Create WebSocket server
      this.wss = new WSServer({
        port: finalPort,
        maxPayload: this.config.maxMessageSize,
        verifyClient: (info) => this.verifyClient(info)
      });
      
      // Set up event handlers
      this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
      this.wss.on('error', (error) => this.handleError(error));
      
      this.server = this.wss;
      this.startTime = Date.now();
      this.port = finalPort;
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Emit started event
      this.emit('started', {
        port: finalPort,
        url: `ws://localhost:${finalPort}`
      });
      
      return {
        success: true,
        port: finalPort,
        url: `ws://localhost:${finalPort}`
      };
      
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise<Object>} Stop result
   */
  async stop() {
    if (!this.isRunning()) {
      return {
        success: false,
        error: 'Server is not running'
      };
    }
    
    try {
      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      
      // Close all client connections
      for (const client of this.clients) {
        if (client.readyState === 1) { // OPEN
          client.close(1000, 'Server shutting down');
        }
      }
      
      // Clear client tracking
      this.clients.clear();
      this.clientInfo.clear();
      
      // Close WebSocket server
      await new Promise((resolve, reject) => {
        this.wss.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      this.server = null;
      this.wss = null;
      this.port = null;
      
      // Emit stopped event
      this.emit('stopped');
      
      return {
        success: true
      };
      
    } catch (error) {
      this.emit('error', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if server is running
   * @returns {boolean} True if running
   */
  isRunning() {
    return this.server !== null && this.wss !== null;
  }

  /**
   * Get the server port
   * @returns {number|null} Port number or null
   */
  getPort() {
    return this.port || null;
  }

  /**
   * Get number of connected clients
   * @returns {number} Number of connected clients
   */
  getConnectedClients() {
    return this.clients.size;
  }

  /**
   * Get client health information
   * @returns {Array} Client health data
   */
  getClientHealth() {
    const health = [];
    
    for (const [clientId, info] of this.clientInfo) {
      health.push({
        clientId,
        connected: this.clients.has(info.ws),
        address: info.address,
        connectedAt: info.connectedAt,
        lastActivity: info.lastActivity,
        messageCount: info.messageCount
      });
    }
    
    return health;
  }

  /**
   * Get server statistics
   * @returns {Object} Server statistics
   */
  getStatistics() {
    return {
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      currentConnections: this.clients.size,
      totalConnections: this.connectionStats.total,
      totalMessages: this.messageStats.total,
      messagesByType: { ...this.messageStats.byType },
      port: this.port,
      running: this.isRunning()
    };
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Request} req - HTTP request
   */
  handleConnection(ws, req) {
    // Check max connections
    if (this.clients.size >= this.config.maxConnections) {
      ws.close(1008, 'Max connections reached');
      return;
    }
    
    const clientId = generateId('client');
    const address = req.socket.remoteAddress;
    
    // Track client
    this.clients.add(ws);
    this.clientInfo.set(clientId, {
      ws,
      clientId,
      address,
      connectedAt: new Date(),
      lastActivity: new Date(),
      lastPong: Date.now(),
      messageCount: 0,
      messageTimestamps: []
    });
    
    // Update stats
    this.connectionStats.total++;
    this.connectionStats.current = this.clients.size;
    
    // Set up client event handlers
    ws.on('message', (data) => this.handleMessage(ws, clientId, data));
    ws.on('close', () => this.handleClose(ws, clientId));
    ws.on('error', (error) => this.handleClientError(ws, clientId, error));
    ws.on('pong', () => this.handlePong(clientId));
    
    // Emit connection event
    this.emit('connection', {
      clientId,
      address,
      timestamp: new Date()
    });
  }

  /**
   * Handle incoming message from client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Client identifier
   * @param {Buffer} data - Message data
   */
  async handleMessage(ws, clientId, data) {
    const info = this.clientInfo.get(clientId);
    if (!info) return;
    
    // Update activity
    info.lastActivity = new Date();
    info.messageCount++;
    
    // Rate limiting
    if (this.config.rateLimit) {
      const now = Date.now();
      info.messageTimestamps = info.messageTimestamps.filter(
        t => now - t < this.config.rateLimit.window
      );
      
      if (info.messageTimestamps.length >= this.config.rateLimit.messages) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      info.messageTimestamps.push(now);
    }
    
    try {
      const message = JSON.parse(data.toString());
      
      // Update statistics
      this.messageStats.total++;
      this.messageStats.byType[message.type] = 
        (this.messageStats.byType[message.type] || 0) + 1;
      
      // Process message based on type
      switch (message.type) {
        case 'log':
          await this.processLogMessage(message, clientId);
          break;
        case 'error':
          await this.processErrorMessage(message, clientId);
          break;
        case 'network':
          await this.processNetworkMessage(message, clientId);
          break;
        case 'batch':
          await this.processBatchMessage(message, clientId);
          break;
        default:
          this.emit('unknownMessage', { type: message.type, clientId });
      }
      
    } catch (error) {
      this.emit('invalidMessage', {
        error: `Invalid JSON: ${error.message}`,
        clientId
      });
    }
  }

  /**
   * Process log message
   * @param {Object} message - Log message
   * @param {string} clientId - Client identifier
   */
  async processLogMessage(message, clientId) {
    const logEntry = {
      sessionId: message.sessionId || 'frontend',
      source: 'frontend',
      level: message.level || 'info',
      message: message.message,
      timestamp: new Date(message.timestamp || Date.now()),
      metadata: {
        clientId,
        url: message.url,
        userAgent: message.userAgent
      }
    };
    
    await this.logStorage.storeLog(logEntry);
    
    this.emit('logReceived', {
      ...logEntry,
      clientId
    });
  }

  /**
   * Process error message
   * @param {Object} message - Error message
   * @param {string} clientId - Client identifier
   */
  async processErrorMessage(message, clientId) {
    const errorEntry = {
      sessionId: message.sessionId || 'frontend',
      source: 'frontend',
      level: 'error',
      message: message.message,
      timestamp: new Date(message.timestamp || Date.now()),
      metadata: {
        clientId,
        stack: message.stack,
        url: message.url,
        line: message.line,
        column: message.column
      }
    };
    
    await this.logStorage.storeLog(errorEntry);
    
    this.emit('errorReceived', {
      ...errorEntry,
      clientId
    });
  }

  /**
   * Process network message
   * @param {Object} message - Network request/response data
   * @param {string} clientId - Client identifier
   */
  async processNetworkMessage(message, clientId) {
    const networkEntry = {
      sessionId: message.sessionId || 'frontend',
      source: 'frontend-network',
      level: 'info',
      message: `${message.method} ${message.url} - ${message.status}`,
      timestamp: new Date(message.timestamp || Date.now()),
      metadata: {
        clientId,
        method: message.method,
        url: message.url,
        status: message.status,
        duration: message.duration,
        size: message.size
      }
    };
    
    await this.logStorage.storeLog(networkEntry);
    
    this.emit('networkReceived', {
      ...networkEntry,
      clientId
    });
  }

  /**
   * Process batch of messages
   * @param {Object} message - Batch message
   * @param {string} clientId - Client identifier
   */
  async processBatchMessage(message, clientId) {
    const messages = message.messages || [];
    const logEntries = [];
    
    for (const msg of messages) {
      logEntries.push({
        sessionId: msg.sessionId || message.sessionId || 'frontend',
        source: 'frontend',
        level: msg.level || 'info',
        message: msg.message,
        timestamp: new Date(msg.timestamp || Date.now()),
        metadata: {
          clientId,
          ...msg.metadata
        }
      });
    }
    
    if (logEntries.length > 0) {
      await this.logStorage.batchStore(logEntries);
    }
    
    this.emit('batchProcessed', {
      count: logEntries.length,
      clientId
    });
  }

  /**
   * Handle client disconnect
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Client identifier
   */
  handleClose(ws, clientId) {
    this.clients.delete(ws);
    this.clientInfo.delete(clientId);
    this.connectionStats.current = this.clients.size;
    
    this.emit('disconnection', {
      clientId,
      timestamp: new Date()
    });
  }

  /**
   * Handle client error
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Client identifier
   * @param {Error} error - Error object
   */
  handleClientError(ws, clientId, error) {
    this.emit('clientError', {
      clientId,
      error: error.message
    });
  }

  /**
   * Handle pong response
   * @param {string} clientId - Client identifier
   */
  handlePong(clientId) {
    const info = this.clientInfo.get(clientId);
    if (info) {
      info.lastPong = Date.now();
    }
  }

  /**
   * Handle server error
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.emit('error', { error });
  }

  /**
   * Verify client connection
   * @param {Object} info - Connection info
   * @returns {boolean} True if connection allowed
   */
  verifyClient(info) {
    // Check origin if configured
    if (this.config.allowedOrigins) {
      const origin = info.origin || info.req.headers.origin;
      if (!this.config.allowedOrigins.includes(origin)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const ws of this.clients) {
        if (ws.readyState === 1) { // OPEN
          // Find client info
          let clientId = null;
          for (const [id, info] of this.clientInfo) {
            if (info.ws === ws) {
              clientId = id;
              break;
            }
          }
          
          if (clientId) {
            const info = this.clientInfo.get(clientId);
            
            // Check if client is responsive
            if (info.lastPong && now - info.lastPong > this.config.heartbeatTimeout) {
              ws.close(1001, 'Heartbeat timeout');
            } else {
              ws.ping();
            }
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Find available port
   * @param {number} startPort - Starting port
   * @returns {Promise<number>} Available port
   */
  async findAvailablePort(startPort) {
    let port = startPort;
    
    while (await this.isPortInUse(port)) {
      port++;
      if (port > 65535) {
        throw new Error('No available ports');
      }
    }
    
    return port;
  }

  /**
   * Check if port is in use
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if in use
   */
  async isPortInUse(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(true); // Port is in use
      });
      
      server.once('listening', () => {
        server.close();
        resolve(false); // Port is available
      });
      
      server.listen(port);
    });
  }
}