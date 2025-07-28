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
    this.codec = config.codec; // Codec for message validation
    
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
      let message;
      let validationResult = null;
      
      // First parse as JSON
      const rawMessage = JSON.parse(data.toString());
      
      // Try to decode/validate with codec if available
      if (this.codec && rawMessage.type) {
        const decodeResult = this.codec.decode(data.toString());
        if (decodeResult.success) {
          message = decodeResult.decoded;
          validationResult = { success: true, validated: true };
          
          await this.logManager.logInfo('Message validated with codec', {
            source: 'WebSocketHandler',
            operation: 'message-validated',
            clientId: connection.clientId,
            type: message.type,
            method: message.method
          });
        } else {
          // Codec validation failed, but still process the raw message
          message = rawMessage;
          validationResult = { success: false, error: decodeResult.error };
          
          await this.logManager.logWarning('Message failed codec validation, processing as raw JSON', {
            source: 'WebSocketHandler',
            operation: 'validation-fallback',
            clientId: connection.clientId,
            validationError: decodeResult.error,
            type: rawMessage.type
          });
        }
      } else {
        // No codec or no message type, process as raw message
        message = rawMessage;
        validationResult = { success: true, validated: false };
      }
      
      await this.logManager.logInfo('Received WebSocket message', {
        source: 'WebSocketHandler',
        operation: 'message-received',
        clientId: connection.clientId,
        type: message.type,
        method: message.method,
        codecValidated: validationResult.validated
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
          
        case 'schema_request':
          await this._handleSchemaRequest(ws, message);
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
        success: true,
        codecEnabled: this.codec ? true : false,
        created: sessionInfo.created,
        capabilities: sessionInfo.capabilities
      }, 'session_create_response');
      
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
        type: 'session_created', // Use consistent response type
        requestId: message.requestId,
        sessionId: sessionId,
        success: true,
        codecEnabled: this.codec ? true : false,
        created: session.created,
        lastAccessed: session.lastAccessed
      }, 'session_create_response');
      
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
      }, 'mcp_response');
      
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
   * Handle schema request from client
   * @private
   */
  async _handleSchemaRequest(ws, message) {
    const connection = this.connections.get(ws);
    
    try {
      if (!this.codec) {
        this._sendError(ws, message.requestId, 'Codec system not available');
        return;
      }
      
      // Create schema definition message
      const schemaDefinition = this.codec.createSchemaDefinitionMessage();
      
      // Send response using codec if possible
      const response = {
        type: 'schema_definition',
        requestId: message.requestId,
        schemas: schemaDefinition.schemas,
        messageTypes: schemaDefinition.messageTypes
      };
      
      this._sendMessage(ws, response, 'schema_definition');
      
      await this.logManager.logInfo('Schema definition sent to client', {
        source: 'WebSocketHandler',
        operation: 'schema-sent',
        clientId: connection.clientId,
        requestId: message.requestId,
        schemaCount: Object.keys(schemaDefinition.schemas).length
      });
      
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'WebSocketHandler',
        operation: 'schema-request-error',
        clientId: connection.clientId,
        requestId: message.requestId
      });
      
      this._sendError(ws, message.requestId, `Schema request failed: ${error.message}`);
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
  _sendMessage(ws, message, messageType = null) {
    if (ws.readyState !== ws.OPEN) {
      return;
    }
    
    try {
      let messageToSend;
      
      // Try to encode with codec if available and messageType is provided
      if (this.codec && (messageType || message.type)) {
        const type = messageType || message.type;
        const encodeResult = this.codec.encode(type, message);
        
        if (encodeResult.success) {
          messageToSend = encodeResult.encoded;
          
          // Log successful codec encoding
          const connection = this.connections.get(ws);
          if (connection) {
            this.logManager.logInfo('Message encoded with codec', {
              source: 'WebSocketHandler',
              operation: 'message-encoded',
              clientId: connection.clientId,
              messageType: type,
              codecEnabled: true
            });
          }
        } else {
          // Codec encoding failed, fall back to JSON
          messageToSend = JSON.stringify(message);
          
          const connection = this.connections.get(ws);
          if (connection) {
            this.logManager.logWarning('Codec encoding failed, using JSON fallback', {
              source: 'WebSocketHandler',
              operation: 'encoding-fallback',
              clientId: connection.clientId,
              messageType: type,
              codecError: encodeResult.error
            });
          }
        }
      } else {
        // No codec or no message type, use JSON
        messageToSend = JSON.stringify(message);
      }
      
      ws.send(messageToSend);
      
    } catch (error) {
      const connection = this.connections.get(ws);
      if (connection) {
        this.logManager.logError(error, {
          source: 'WebSocketHandler',
          operation: 'send-message-error',
          clientId: connection.clientId,
          messageType: messageType || message.type
        });
      }
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
    }, 'error_message');
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