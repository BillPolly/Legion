import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * Connection Manager for Cerebrate WebSocket Server
 * Manages WebSocket connections, state tracking, and message routing
 */
export class ConnectionManager extends EventEmitter {
  
  constructor(options = {}) {
    super();
    
    this.config = {
      maxConnections: options.maxConnections || 100,
      heartbeatInterval: options.heartbeatInterval || 30000,
      connectionTimeout: options.connectionTimeout || 60000,
      rateLimitWindowMs: options.rateLimitWindowMs || 60000,
      rateLimitMaxConnections: options.rateLimitMaxConnections || 10,
      ...options
    };
    
    this.sessionManager = options.sessionManager;
    this.connections = new Map(); // sessionId -> connection info
    this.connectionsByWs = new Map(); // ws -> sessionId
    this.rateLimitTracking = new Map(); // IP -> connection attempts
    
    this.statistics = {
      total_connections_created: 0,
      total_connections_closed: 0,
      total_messages_sent: 0,
      total_messages_received: 0
    };
    
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  /**
   * Add a new WebSocket connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {Object} metadata - Connection metadata
   * @returns {string|null} - Session ID or null if rejected
   */
  addConnection(ws, metadata) {
    // Check connection limit
    if (this.connections.size >= this.config.maxConnections) {
      ws.close(1008, 'Connection limit exceeded');
      return null;
    }

    // Check rate limiting
    if (!this.checkRateLimit(metadata.remoteAddress)) {
      ws.close(1008, 'Rate limit exceeded');
      return null;
    }

    // Create session
    const sessionId = this.sessionManager.createSession();
    
    // Create connection info
    const connectionInfo = {
      ws,
      sessionId,
      metadata: {
        ...metadata,
        connectedAt: new Date()
      },
      lastActivity: new Date(),
      lastPong: new Date(),
      timeoutId: null
    };

    // Store connection mappings
    this.connections.set(sessionId, connectionInfo);
    this.connectionsByWs.set(ws, sessionId);

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(ws, sessionId);

    // Update statistics
    this.statistics.total_connections_created++;

    // Set up connection timeout
    this.resetConnectionTimeout(connectionInfo);

    this.emit('connection-added', {
      sessionId,
      metadata: connectionInfo.metadata,
      totalConnections: this.connections.size
    });

    return sessionId;
  }

  /**
   * Remove connection and clean up
   * @param {string} sessionId - Session ID to remove
   */
  removeConnection(sessionId) {
    const connectionInfo = this.connections.get(sessionId);
    if (!connectionInfo) {
      // Still notify session manager even if connection not found
      this.sessionManager.disconnectSession(sessionId);
      return;
    }

    // Clear timeout
    if (connectionInfo.timeoutId) {
      clearTimeout(connectionInfo.timeoutId);
    }

    // Remove from mappings
    this.connections.delete(sessionId);
    this.connectionsByWs.delete(connectionInfo.ws);

    // Disconnect session
    this.sessionManager.disconnectSession(sessionId);

    // Update statistics
    this.statistics.total_connections_closed++;

    this.emit('connection-removed', {
      sessionId,
      duration: Date.now() - connectionInfo.metadata.connectedAt.getTime(),
      totalConnections: this.connections.size
    });
  }

  /**
   * Get connection by session ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Connection info or null
   */
  getConnectionBySession(sessionId) {
    return this.connections.get(sessionId) || null;
  }

  /**
   * Get all active connections
   * @returns {Array} - Array of connection info objects
   */
  getAllConnections() {
    return Array.from(this.connections.values()).map(conn => ({
      sessionId: conn.sessionId,
      metadata: conn.metadata,
      lastActivity: conn.lastActivity,
      state: conn.ws.readyState
    }));
  }

  /**
   * Get current connection count
   * @returns {number} - Number of active connections
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Broadcast message to all connections
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    const serializedMessage = JSON.stringify(message);
    
    for (const connectionInfo of this.connections.values()) {
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        try {
          connectionInfo.ws.send(serializedMessage);
          this.statistics.total_messages_sent++;
        } catch (error) {
          this.handleConnectionError(connectionInfo.sessionId, error);
        }
      }
    }
  }

  /**
   * Send message to specific session
   * @param {string} sessionId - Target session ID
   * @param {Object} message - Message to send
   */
  sendToSession(sessionId, message) {
    const connectionInfo = this.connections.get(sessionId);
    if (!connectionInfo) {
      return false;
    }

    if (connectionInfo.ws.readyState === WebSocket.OPEN) {
      try {
        const serializedMessage = JSON.stringify(message);
        connectionInfo.ws.send(serializedMessage);
        this.statistics.total_messages_sent++;
        return true;
      } catch (error) {
        this.handleConnectionError(sessionId, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getConnectionStatistics() {
    const connectionsByState = {};
    let activeConnections = 0;

    for (const connectionInfo of this.connections.values()) {
      const state = connectionInfo.ws.readyState;
      connectionsByState[state] = (connectionsByState[state] || 0) + 1;
      
      if (state === WebSocket.OPEN) {
        activeConnections++;
      }
    }

    return {
      total_connections: this.connections.size,
      active_connections: activeConnections,
      connections_by_state: connectionsByState,
      ...this.statistics
    };
  }

  /**
   * Setup WebSocket event handlers
   * @param {WebSocket} ws - WebSocket instance
   * @param {string} sessionId - Session ID
   * @private
   */
  setupWebSocketHandlers(ws, sessionId) {
    ws.on('message', (data) => {
      this.handleMessage(sessionId, data);
    });

    ws.on('close', (code, reason) => {
      this.removeConnection(sessionId);
    });

    ws.on('error', (error) => {
      this.handleConnectionError(sessionId, error);
    });

    ws.on('pong', () => {
      this.handlePong(sessionId);
    });
  }

  /**
   * Handle incoming message
   * @param {string} sessionId - Session ID
   * @param {Buffer} data - Message data
   * @private
   */
  handleMessage(sessionId, data) {
    const connectionInfo = this.connections.get(sessionId);
    if (!connectionInfo) {
      return;
    }

    // Update activity
    connectionInfo.lastActivity = new Date();
    this.sessionManager.updateActivity(sessionId);
    this.statistics.total_messages_received++;

    // Reset connection timeout
    this.resetConnectionTimeout(connectionInfo);

    this.emit('message-received', {
      sessionId,
      data: data.toString(),
      metadata: connectionInfo.metadata
    });
  }

  /**
   * Handle connection errors
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error object
   * @private
   */
  handleConnectionError(sessionId, error) {
    const connectionInfo = this.connections.get(sessionId);
    
    this.emit('connection-error', {
      sessionId,
      error,
      metadata: connectionInfo?.metadata
    });

    // Remove connection on error
    this.removeConnection(sessionId);
  }

  /**
   * Handle pong response
   * @param {string} sessionId - Session ID
   * @private
   */
  handlePong(sessionId) {
    const connectionInfo = this.connections.get(sessionId);
    if (connectionInfo) {
      connectionInfo.lastPong = new Date();
      this.resetConnectionTimeout(connectionInfo);
    }
  }

  /**
   * Check rate limiting for IP address
   * @param {string} remoteAddress - Client IP address
   * @returns {boolean} - True if allowed
   * @private
   */
  checkRateLimit(remoteAddress) {
    if (!remoteAddress) return true;

    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindowMs;

    // Get or create tracking for this IP
    let ipTracking = this.rateLimitTracking.get(remoteAddress);
    if (!ipTracking) {
      ipTracking = { attempts: [], connections: 0 };
      this.rateLimitTracking.set(remoteAddress, ipTracking);
    }

    // Remove old attempts outside the window
    ipTracking.attempts = ipTracking.attempts.filter(time => time > windowStart);

    // Check if over the limit
    if (ipTracking.attempts.length >= this.config.rateLimitMaxConnections) {
      return false;
    }

    // Record this attempt
    ipTracking.attempts.push(now);
    return true;
  }

  /**
   * Reset connection timeout
   * @param {Object} connectionInfo - Connection info object
   * @private
   */
  resetConnectionTimeout(connectionInfo) {
    // Clear existing timeout
    if (connectionInfo.timeoutId) {
      clearTimeout(connectionInfo.timeoutId);
    }

    // Set new timeout
    connectionInfo.timeoutId = setTimeout(() => {
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        connectionInfo.ws.close(1011, 'Connection timeout');
      }
    }, this.config.connectionTimeout);
  }

  /**
   * Start heartbeat mechanism
   * @private
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const connectionInfo of this.connections.values()) {
        if (connectionInfo.ws.readyState === WebSocket.OPEN) {
          try {
            connectionInfo.ws.ping();
          } catch (error) {
            this.handleConnectionError(connectionInfo.sessionId, error);
          }
        }
      }
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
   * Close specific connection
   * @param {string} sessionId - Session ID to close
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  closeConnection(sessionId, code = 1000, reason = 'Normal closure') {
    const connectionInfo = this.connections.get(sessionId);
    if (connectionInfo && connectionInfo.ws.readyState === WebSocket.OPEN) {
      connectionInfo.ws.close(code, reason);
    }
  }

  /**
   * Close all connections and cleanup
   */
  cleanup() {
    // Stop heartbeat
    this.stopHeartbeat();

    // Close all connections
    for (const connectionInfo of this.connections.values()) {
      if (connectionInfo.timeoutId) {
        clearTimeout(connectionInfo.timeoutId);
      }
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        connectionInfo.ws.close(1001, 'Server shutdown');
      }
    }

    // Clear all mappings
    this.connections.clear();
    this.connectionsByWs.clear();
    this.rateLimitTracking.clear();

    this.emit('cleanup-complete');
  }

  /**
   * Destroy connection manager and cleanup all resources
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
  }

  /**
   * Get configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Restart heartbeat if interval changed
    if (newConfig.heartbeatInterval) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }
}