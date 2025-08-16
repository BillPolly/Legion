/**
 * WebSocketService
 * Manages WebSocket connections and actor communication
 */

export class WebSocketService {
  constructor(wss, actorManager) {
    this.wss = wss;
    this.actorManager = actorManager;
    this.connections = new Map();
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const clientIp = req.socket.remoteAddress;
    
    console.log(`📡 New connection ${connectionId} from ${clientIp}`);
    
    // Store connection info
    this.connections.set(connectionId, {
      ws,
      ip: clientIp,
      connectedAt: new Date(),
      actorSpace: null
    });
    
    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(connectionId, data);
    });
    
    // Handle close
    ws.on('close', () => {
      this.handleClose(connectionId);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      this.handleError(connectionId, error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      connectionId,
      timestamp: new Date().toISOString()
    }));
  }
  
  /**
   * Handle incoming message
   */
  async handleMessage(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    try {
      const message = JSON.parse(data.toString());
      
      // Handle actor handshake
      if (message.type === 'actor_handshake') {
        await this.handleActorHandshake(connectionId, message);
      }
      // All other messages are handled by ActorSpace
      else if (connection.actorSpace) {
        // ActorSpace handles routing
        connection.actorSpace.handleIncomingMessage(message);
      } else {
        console.warn(`Message received before handshake from ${connectionId}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${connectionId}:`, error);
      this.sendError(connection.ws, error);
    }
  }
  
  /**
   * Handle actor handshake
   */
  async handleActorHandshake(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    try {
      console.log(`🤝 Actor handshake from ${connectionId}`);
      
      // Create actor space for this connection
      const actorSpace = await this.actorManager.createActorSpace(connectionId);
      connection.actorSpace = actorSpace;
      
      // Get server actor GUIDs
      const serverActors = this.actorManager.getActorGuids(connectionId);
      
      // Send handshake acknowledgment
      connection.ws.send(JSON.stringify({
        type: 'actor_handshake_ack',
        serverActors
      }));
      
      // Setup channel and remote actors
      const channel = actorSpace.addChannel(connection.ws);
      
      // Create remote actors for client actors
      if (message.clientActors) {
        this.actorManager.setupRemoteActors(connectionId, channel, message.clientActors);
      }
      
      console.log(`✅ Handshake complete for ${connectionId}`);
    } catch (error) {
      console.error(`Handshake failed for ${connectionId}:`, error);
      this.sendError(connection.ws, error);
    }
  }
  
  /**
   * Handle connection close
   */
  async handleClose(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    console.log(`🔌 Connection ${connectionId} closed`);
    
    // Cleanup actor space
    if (connection.actorSpace) {
      await this.actorManager.cleanupActorSpace(connectionId);
    }
    
    // Remove connection
    this.connections.delete(connectionId);
    
    // Log connection stats
    const duration = Date.now() - connection.connectedAt.getTime();
    console.log(`  Duration: ${Math.round(duration / 1000)}s`);
  }
  
  /**
   * Handle connection error
   */
  handleError(connectionId, error) {
    console.error(`❌ WebSocket error for ${connectionId}:`, error);
    
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === 1) {
      this.sendError(connection.ws, error);
    }
  }
  
  /**
   * Send error message to client
   */
  sendError(ws, error) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get connection statistics
   */
  getStats() {
    const connections = Array.from(this.connections.values());
    
    return {
      totalConnections: connections.length,
      connections: connections.map(conn => ({
        ip: conn.ip,
        connectedAt: conn.connectedAt,
        duration: Date.now() - conn.connectedAt.getTime(),
        hasActorSpace: !!conn.actorSpace
      }))
    };
  }
  
  /**
   * Broadcast message to all connections
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    
    this.connections.forEach((connection) => {
      if (connection.ws.readyState === 1) {
        connection.ws.send(data);
      }
    });
  }
  
  /**
   * Cleanup all connections
   */
  async cleanup() {
    console.log('  🔌 Cleaning up WebSocket connections...');
    
    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      if (connection.ws.readyState === 1) {
        connection.ws.close(1000, 'Server shutting down');
      }
      
      // Cleanup actor space
      if (connection.actorSpace) {
        await this.actorManager.cleanupActorSpace(connectionId);
      }
    }
    
    // Clear connections
    this.connections.clear();
    
    console.log('  ✅ WebSocket connections cleaned up');
  }
}