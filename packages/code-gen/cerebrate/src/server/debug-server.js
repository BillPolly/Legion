import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { SessionManager } from './SessionManager.js';
import { WebSocketProtocol } from '../shared/protocol/WebSocketProtocol.js';

/**
 * Debug Server for Cerebrate
 * WebSocket server that handles debug connections and manages sessions
 */
export class DebugServer extends EventEmitter {
  
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 9222,
      host: config.host || 'localhost',
      maxPayload: config.maxPayload || (1024 * 1024), // 1MB default
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      maxConnections: config.maxConnections || 100,
      supportedProtocols: config.supportedProtocols || ['cerebrate-debug-v1'],
      ...config
    };
    
    this.server = null;
    this.sessionManager = new SessionManager();
    this.connections = new Map(); // Store connection metadata
    this.statistics = {
      started_at: null,
      current_connections: 0,
      total_connections_accepted: 0,
      total_connections_closed: 0,
      total_messages_received: 0,
      total_messages_sent: 0
    };
    
    this.heartbeatInterval = null;
  }

  /**
   * Get server port
   */
  get port() {
    return this.config.port;
  }

  /**
   * Get server host
   */
  get host() {
    return this.config.host;
  }

  /**
   * Check if server is running
   * @returns {boolean} - True if server is running
   */
  isRunning() {
    return this.server !== null && this.server.readyState === WebSocketServer.OPEN;
  }

  /**
   * Start the WebSocket server
   * @returns {Promise} - Resolves when server is started
   */
  async start() {
    if (this.isRunning()) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: this.config.port,
          host: this.config.host,
          perMessageDeflate: false,
          maxPayload: this.config.maxPayload,
          handleProtocols: this.handleProtocols.bind(this)
        });

        this.server.on('listening', () => {
          this.statistics.started_at = new Date();
          this.startHeartbeat();
          this.emit('server-started', this.getServerInfo());
          resolve();
        });

        this.server.on('connection', this.handleConnection.bind(this));
        
        this.server.on('error', (error) => {
          this.emit('server-error', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise} - Resolves when server is stopped
   */
  async stop() {
    if (!this.isRunning()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.stopHeartbeat();
      
      // Close all connections
      this.server.clients.forEach((ws) => {
        ws.terminate();
      });

      this.server.close(() => {
        this.server = null;
        this.connections.clear();
        this.statistics.current_connections = 0;
        this.sessionManager.cleanup();
        this.emit('server-stopped');
        resolve();
      });
    });
  }

  /**
   * Handle protocol selection for WebSocket connections
   * @param {Array} protocols - Requested protocols
   * @returns {string|false} - Selected protocol or false to reject
   */
  handleProtocols(protocols) {
    // Allow connection without specific protocol
    if (!protocols || protocols.length === 0) {
      return false; // Use default protocol
    }

    // Find supported protocol
    for (const protocol of protocols) {
      if (this.config.supportedProtocols.includes(protocol)) {
        return protocol;
      }
    }

    // Reject if no supported protocol found
    return false;
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} request - HTTP request object
   */
  handleConnection(ws, request) {
    // Check connection limit
    if (this.statistics.current_connections >= this.config.maxConnections) {
      ws.close(1008, 'Maximum connections exceeded');
      return;
    }

    // Create session for this connection
    const sessionId = this.sessionManager.createSession();
    
    // Store connection metadata
    const connectionInfo = {
      sessionId,
      connectedAt: new Date(),
      remoteAddress: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      protocol: ws.protocol || 'default'
    };
    
    this.connections.set(ws, connectionInfo);
    
    // Update statistics
    this.statistics.current_connections++;
    this.statistics.total_connections_accepted++;

    // Set up connection event handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', (code, reason) => this.handleDisconnection(ws, code, reason));
    ws.on('error', (error) => this.handleConnectionError(ws, error));
    ws.on('pong', () => this.handlePong(ws));

    this.emit('connection-established', {
      sessionId,
      connectionInfo,
      totalConnections: this.statistics.current_connections
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} data - Message data
   */
  handleMessage(ws, data) {
    try {
      this.statistics.total_messages_received++;
      
      const connectionInfo = this.connections.get(ws);
      if (!connectionInfo) {
        ws.close(1002, 'Connection not found');
        return;
      }

      // Update session activity
      this.sessionManager.updateActivity(connectionInfo.sessionId);

      // Deserialize message
      const message = WebSocketProtocol.deserializeMessage(data.toString());
      
      // Validate message
      const validation = WebSocketProtocol.validateWebSocketMessage(message);
      if (!validation.isValid) {
        const errorResponse = WebSocketProtocol.formatErrorResponse(
          message.id || 'unknown',
          'INVALID_MESSAGE',
          'Message validation failed',
          { errors: validation.errors },
          ['Check message format', 'Ensure all required fields are present'],
          connectionInfo.sessionId
        );
        this.sendMessage(ws, errorResponse);
        return;
      }

      // Emit message event for further processing
      this.emit('message-received', {
        ws,
        message,
        sessionId: connectionInfo.sessionId
      });

    } catch (error) {
      this.handleMessageError(ws, error);
    }
  }

  /**
   * Handle WebSocket disconnection
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} code - Close code
   * @param {Buffer} reason - Close reason
   */
  handleDisconnection(ws, code, reason) {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      // Disconnect session
      this.sessionManager.disconnectSession(connectionInfo.sessionId);
      
      // Clean up connection
      this.connections.delete(ws);
      this.statistics.current_connections--;
      this.statistics.total_connections_closed++;

      this.emit('connection-closed', {
        sessionId: connectionInfo.sessionId,
        code,
        reason: reason?.toString(),
        duration: Date.now() - connectionInfo.connectedAt.getTime()
      });
    }
  }

  /**
   * Handle connection errors
   * @param {WebSocket} ws - WebSocket connection
   * @param {Error} error - Error object
   */
  handleConnectionError(ws, error) {
    const connectionInfo = this.connections.get(ws);
    
    this.emit('connection-error', {
      sessionId: connectionInfo?.sessionId,
      error: error.message,
      stack: error.stack
    });

    // Close connection on error
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle message processing errors
   * @param {WebSocket} ws - WebSocket connection
   * @param {Error} error - Error object
   */
  handleMessageError(ws, error) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) return;

    const errorResponse = WebSocketProtocol.formatErrorResponse(
      'unknown',
      'MESSAGE_PROCESSING_ERROR',
      'Failed to process message',
      { error: error.message },
      ['Check message format', 'Try again with valid message'],
      connectionInfo.sessionId
    );

    this.sendMessage(ws, errorResponse);
  }

  /**
   * Handle pong response
   * @param {WebSocket} ws - WebSocket connection
   */
  handlePong(ws) {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      connectionInfo.lastPong = new Date();
    }
  }

  /**
   * Send message to WebSocket client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendMessage(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const serializedMessage = WebSocketProtocol.serializeMessage(message);
      ws.send(serializedMessage);
      this.statistics.total_messages_sent++;
    } catch (error) {
      this.handleConnectionError(ws, error);
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    this.server.clients.forEach((ws) => {
      this.sendMessage(ws, message);
    });
  }

  /**
   * Send message to specific session
   * @param {string} sessionId - Target session ID
   * @param {Object} message - Message to send
   */
  sendToSession(sessionId, message) {
    for (const [ws, connectionInfo] of this.connections.entries()) {
      if (connectionInfo.sessionId === sessionId) {
        this.sendMessage(ws, message);
        break;
      }
    }
  }

  /**
   * Get current connection count
   * @returns {number} - Number of active connections
   */
  getConnectionCount() {
    return this.statistics.current_connections;
  }

  /**
   * Get server information
   * @returns {Object} - Server information
   */
  getServerInfo() {
    const address = this.server?.address();
    
    return {
      port: this.config.port,
      host: this.config.host,
      address: address,
      protocol: 'ws',
      running: this.isRunning(),
      connections: this.statistics.current_connections,
      uptime: this.statistics.started_at ? Date.now() - this.statistics.started_at.getTime() : 0,
      started_at: this.statistics.started_at,
      supported_protocols: this.config.supportedProtocols
    };
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getConnectionStats() {
    return { ...this.statistics };
  }

  /**
   * Start heartbeat mechanism to check connection health
   * @private
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.server.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   * @private
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get session manager instance
   * @returns {SessionManager} - Session manager
   */
  getSessionManager() {
    return this.sessionManager;
  }

  /**
   * Get active sessions
   * @returns {Array} - Array of active sessions
   */
  getActiveSessions() {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * Close specific connection
   * @param {string} sessionId - Session ID to close
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  closeSession(sessionId, code = 1000, reason = 'Normal closure') {
    for (const [ws, connectionInfo] of this.connections.entries()) {
      if (connectionInfo.sessionId === sessionId) {
        ws.close(code, reason);
        break;
      }
    }
  }

  /**
   * Cleanup and destroy server
   */
  async destroy() {
    await this.stop();
    this.sessionManager.destroy();
    this.removeAllListeners();
  }
}