/**
 * WebSocketHandler - Manages WebSocket communication between clients and server
 * 
 * Handles message routing, session association, and connection lifecycle
 */

export class WebSocketHandler {
  constructor(config) {
    this.sessionManager = config.sessionManager;
    this.requestHandler = config.requestHandler;
    this.logManager = config.logManager;
    
    // Track client connections
    this.connections = new Map(); // ws -> connection info
    this.sessionConnections = new Map(); // sessionId -> Set of ws
  }

  /**
   * Handle a new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Unique client ID
   */
  handleConnection(ws, clientId) {
    // Store connection info
    this.connections.set(ws, {
      clientId,
      sessionId: null,
      authenticated: false,
      requestQueue: new Map() // Track pending requests
    });
    
    // Set up message handler
    ws.on('message', async (data) => {
      await this._handleMessage(ws, data);
    });
    
    // Set up error handler
    ws.on('error', async (error) => {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'connection-error',
        clientId
      });
    });
    
    // Set up close handler
    ws.on('close', () => {
      this._handleDisconnection(ws);
    });
  }

  /**
   * Handle incoming WebSocket message
   * @private
   */
  async _handleMessage(ws, data) {
    const connection = this.connections.get(ws);
    
    if (!connection) {
      return;
    }
    
    try {
      const message = JSON.parse(data.toString());
      
      await this.logManager.logInfo('Received WebSocket message', {
        source: 'WebSocketHandler',
        operation: 'message-received',
        clientId: connection.clientId,
        type: message.type,
        method: message.method
      });
      
      switch (message.type) {
        case 'session_create':
          await this._handleSessionCreate(ws, message);
          break;
          
        case 'session_attach':
          await this._handleSessionAttach(ws, message);
          break;
          
        case 'mcp_request':
          await this._handleMcpRequest(ws, message);
          break;
          
        case 'ping':
          this._sendMessage(ws, { type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          this._sendError(ws, message.requestId, `Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'message-parse-error',
        clientId: connection.clientId
      });
      
      this._sendError(ws, null, 'Invalid message format');
    }
  }

  /**
   * Handle session creation request
   * @private
   */
  async _handleSessionCreate(ws, message) {
    const connection = this.connections.get(ws);
    
    try {
      // Create new session
      const sessionInfo = await this.sessionManager.createSession();
      
      // Associate connection with session
      connection.sessionId = sessionInfo.sessionId;
      connection.authenticated = true;
      
      // Track session connection
      if (!this.sessionConnections.has(sessionInfo.sessionId)) {
        this.sessionConnections.set(sessionInfo.sessionId, new Set());
      }
      this.sessionConnections.get(sessionInfo.sessionId).add(ws);
      
      // Send response
      this._sendMessage(ws, {
        type: 'session_created',
        requestId: message.requestId,
        sessionId: sessionInfo.sessionId,
        created: sessionInfo.created,
        capabilities: sessionInfo.capabilities
      });
      
      await this.logManager.logInfo('Session created via WebSocket', {
        source: 'WebSocketHandler',
        operation: 'session-create',
        clientId: connection.clientId,
        sessionId: sessionInfo.sessionId
      });
      
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'session-create-error',
        clientId: connection.clientId
      });
      
      this._sendError(ws, message.requestId, `Failed to create session: ${error.message}`);
    }
  }

  /**
   * Handle session attach request
   * @private
   */
  async _handleSessionAttach(ws, message) {
    const connection = this.connections.get(ws);
    const { sessionId } = message;
    
    try {
      // Verify session exists
      const session = this.sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Associate connection with session
      connection.sessionId = sessionId;
      connection.authenticated = true;
      
      // Track session connection
      if (!this.sessionConnections.has(sessionId)) {
        this.sessionConnections.set(sessionId, new Set());
      }
      this.sessionConnections.get(sessionId).add(ws);
      
      // Send response
      this._sendMessage(ws, {
        type: 'session_attached',
        requestId: message.requestId,
        sessionId: sessionId,
        created: session.created,
        lastAccessed: session.lastAccessed
      });
      
      await this.logManager.logInfo('Session attached via WebSocket', {
        source: 'WebSocketHandler',
        operation: 'session-attach',
        clientId: connection.clientId,
        sessionId
      });
      
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'session-attach-error',
        clientId: connection.clientId,
        sessionId
      });
      
      this._sendError(ws, message.requestId, `Failed to attach session: ${error.message}`);
    }
  }

  /**
   * Handle MCP request
   * @private
   */
  async _handleMcpRequest(ws, message) {
    const connection = this.connections.get(ws);
    
    // Verify connection has a session
    if (!connection.authenticated || !connection.sessionId) {
      this._sendError(ws, message.requestId, 'Not authenticated. Create or attach to a session first.');
      return;
    }
    
    try {
      // Track the request
      connection.requestQueue.set(message.requestId, {
        method: message.method,
        startTime: Date.now()
      });
      
      // Process the MCP request
      const result = await this.requestHandler.handleRequest({
        method: message.method,
        params: message.params
      }, connection.sessionId);
      
      // Send response
      this._sendMessage(ws, {
        type: 'mcp_response',
        requestId: message.requestId,
        result: result.error ? undefined : result,
        error: result.error
      });
      
      // Clean up request tracking
      connection.requestQueue.delete(message.requestId);
      
      await this.logManager.logInfo('MCP request completed', {
        source: 'WebSocketHandler',
        operation: 'mcp-request-complete',
        clientId: connection.clientId,
        sessionId: connection.sessionId,
        method: message.method,
        duration: Date.now() - connection.requestQueue.get(message.requestId)?.startTime
      });
      
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'mcp-request-error',
        clientId: connection.clientId,
        sessionId: connection.sessionId,
        method: message.method
      });
      
      this._sendError(ws, message.requestId, `Request failed: ${error.message}`);
      
      // Clean up request tracking
      connection.requestQueue.delete(message.requestId);
    }
  }

  /**
   * Handle WebSocket disconnection
   * @private
   */
  _handleDisconnection(ws) {
    const connection = this.connections.get(ws);
    
    if (!connection) {
      return;
    }
    
    // Remove from session connections if attached
    if (connection.sessionId && this.sessionConnections.has(connection.sessionId)) {
      const connections = this.sessionConnections.get(connection.sessionId);
      connections.delete(ws);
      
      // Clean up empty session connection sets
      if (connections.size === 0) {
        this.sessionConnections.delete(connection.sessionId);
      }
    }
    
    // Remove connection tracking
    this.connections.delete(ws);
    
    this.logManager.logInfo('WebSocket disconnected', {
      source: 'WebSocketHandler',
      operation: 'disconnection',
      clientId: connection.clientId,
      sessionId: connection.sessionId,
      pendingRequests: connection.requestQueue.size
    });
  }

  /**
   * Send a message to a WebSocket client
   * @private
   */
  _sendMessage(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error response
   * @private
   */
  _sendError(ws, requestId, errorMessage) {
    this._sendMessage(ws, {
      type: 'error',
      requestId,
      error: {
        code: -32000,
        message: errorMessage
      }
    });
  }

  /**
   * Broadcast a message to all connections for a session
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to broadcast
   */
  broadcastToSession(sessionId, message) {
    const connections = this.sessionConnections.get(sessionId);
    
    if (!connections) {
      return;
    }
    
    for (const ws of connections) {
      this._sendMessage(ws, message);
    }
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  getStats() {
    const sessionStats = {};
    
    for (const [sessionId, connections] of this.sessionConnections) {
      sessionStats[sessionId] = connections.size;
    }
    
    return {
      totalConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values()).filter(c => c.authenticated).length,
      sessions: Object.keys(sessionStats).length,
      sessionConnections: sessionStats
    };
  }
}

export default WebSocketHandler;