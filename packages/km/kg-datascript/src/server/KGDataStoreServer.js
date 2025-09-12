import { ActorSpace } from '@legion/actors';
import { KGDataStoreActor } from './KGDataStoreActor.js';
import WebSocket, { WebSocketServer } from 'ws';

/**
 * KGDataStoreServer - Server that hosts KGDataStoreActor in an ActorSpace
 * and provides WebSocket access for distributed clients
 * 
 * This creates a complete distributed data store where clients can connect
 * via WebSocket and interact with the KG-DataScript database through
 * the Actor framework.
 */
export class KGDataStoreServer {
  constructor(options = {}) {
    this.options = {
      port: 8080,
      host: 'localhost',
      schema: {},
      dataStoreOptions: {},
      maxConnections: 100,
      ...options
    };
    
    // Server state
    this.server = null;
    this.wsServer = null;
    this.actorSpace = null;
    this.dataStoreActor = null;
    this.connectedClients = new Map(); // WebSocket -> { channel, clientId }
    this.isRunning = false;
    
    console.log(`KGDataStoreServer initialized for ${this.options.host}:${this.options.port}`);
  }
  
  /**
   * Start the server and set up the ActorSpace
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }
    
    console.log('Starting KGDataStoreServer...');
    
    // 1. Create ActorSpace for this server
    this.actorSpace = new ActorSpace('kg-datastore-server');
    console.log('✅ ActorSpace created');
    
    // Override ActorSpace's handleIncomingMessage to provide proper sender context
    const originalHandleIncomingMessage = this.actorSpace.handleIncomingMessage.bind(this.actorSpace);
    this.actorSpace.handleIncomingMessage = (decodedMessage, sourceChannel) => {
      this._handleIncomingMessageWithContext(decodedMessage, sourceChannel, originalHandleIncomingMessage);
    };
    
    // 2. Create and register the data store actor
    this.dataStoreActor = new KGDataStoreActor(
      this.options.schema, 
      this.options.dataStoreOptions
    );
    
    // Pass ActorSpace reference to the data store actor
    this.dataStoreActor.setActorSpace(this.actorSpace);
    
    // Register the data store actor with a known GUID
    const dataStoreGuid = 'kg-datastore-actor';
    this.actorSpace.register(this.dataStoreActor, dataStoreGuid);
    console.log(`✅ KGDataStoreActor registered with GUID: ${dataStoreGuid}`);
    
    // 3. Set up WebSocket server
    this.wsServer = new WebSocketServer({
      port: this.options.port,
      host: this.options.host,
      maxClients: this.options.maxConnections
    });
    
    // 4. Handle WebSocket connections
    this.wsServer.on('connection', (websocket, request) => {
      this._handleClientConnection(websocket, request);
    });
    
    this.wsServer.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
    
    this.wsServer.on('listening', () => {
      console.log(`✅ WebSocket server listening on ${this.options.host}:${this.options.port}`);
    });
    
    this.isRunning = true;
    console.log('🚀 KGDataStoreServer started successfully');
    
    return {
      port: this.options.port,
      host: this.options.host,
      actorSpaceId: this.actorSpace.spaceId,
      dataStoreGuid
    };
  }
  
  /**
   * Handle new client WebSocket connections
   * @private
   */
  _handleClientConnection(websocket, request) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const clientIP = request.socket.remoteAddress;
    
    console.log(`📱 New client connected: ${clientId} from ${clientIP}`);
    
    // Create a WebSocket wrapper that matches Channel expectations
    const websocketWrapper = {
      send: (data) => websocket.send(data),
      close: () => websocket.close(),
      onmessage: null,
      onclose: null,
      onerror: null,
      onopen: null
    };
    
    // Bridge Node.js WebSocket events to wrapper properties
    websocket.on('message', (data) => {
      if (websocketWrapper.onmessage) {
        websocketWrapper.onmessage({ data: data.toString() });
      }
    });
    
    websocket.on('close', (code, reason) => {
      if (websocketWrapper.onclose) {
        websocketWrapper.onclose({ code, reason });
      }
    });
    
    websocket.on('error', (error) => {
      if (websocketWrapper.onerror) {
        websocketWrapper.onerror(error);
      }
    });
    
    // Create a Channel for this WebSocket connection
    const channel = this.actorSpace.addChannel(websocketWrapper);
    
    // Track the client with additional response handling
    this.connectedClients.set(websocket, {
      channel,
      clientId,
      connectedAt: new Date(),
      remoteAddress: clientIP,
      websocket // Store reference for direct responses
    });
    
    // Additional WebSocket event handlers for cleanup
    websocket.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this._handleClientDisconnection(websocket);
    });
    
    websocket.on('close', (code, reason) => {
      console.log(`📱 Client ${clientId} disconnected: ${code} ${reason}`);
      this._handleClientDisconnection(websocket);
    });
    
    // Send welcome message with connection info
    this._sendWelcomeMessage(websocket, clientId);
  }
  
  /**
   * Handle incoming messages with proper sender context for responses
   * @private
   */
  _handleIncomingMessageWithContext(decodedMessage, sourceChannel, originalHandler) {
    const { targetGuid, payload } = decodedMessage;
    
    // Find the WebSocket client for this channel
    let clientInfo = null;
    for (const [websocket, info] of this.connectedClients) {
      if (info.channel === sourceChannel) {
        clientInfo = info;
        break;
      }
    }
    
    if (!clientInfo) {
      console.warn('Could not find client info for incoming message channel');
      return originalHandler(decodedMessage, sourceChannel);
    }
    
    // Get the target actor
    const targetActor = this.actorSpace.guidToObject.get(targetGuid);
    if (!targetActor) {
      console.error(`ActorSpace ${this.actorSpace.spaceId}: Received message for unknown local target GUID: ${targetGuid}`);
      return;
    }
    
    // Extract requestId from payload if present
    const requestId = payload?.requestId;
    
    // Create a sender context that can send responses back to the WebSocket client
    const senderContext = {
      sender: {
        guid: clientInfo.clientId,
        receive: (responseMessage) => {
          try {
            clientInfo.websocket.send(JSON.stringify(responseMessage));
            console.log(`📤 Response sent to client ${clientInfo.clientId}:`, responseMessage.type);
          } catch (error) {
            console.error(`Error sending response to client ${clientInfo.clientId}:`, error);
          }
        }
      },
      clientId: clientInfo.clientId,
      channel: sourceChannel
    };
    
    // Call the target actor with proper context
    try {
      if (Array.isArray(payload)) {
        targetActor.receive(...payload, senderContext);
      } else {
        targetActor.receive(payload, senderContext);
      }
    } catch (error) {
      console.error(`Error handling message for ${targetGuid}:`, error);
      
      // Send error response if requestId was provided
      if (requestId && clientInfo) {
        try {
          clientInfo.websocket.send(JSON.stringify({
            type: 'response',
            requestId,
            success: false,
            error: error.message
          }));
        } catch (sendError) {
          console.error(`Error sending error response to client ${clientInfo.clientId}:`, sendError);
        }
      }
    }
  }
  
  /**
   * Send welcome message to newly connected client
   * @private
   */
  _sendWelcomeMessage(websocket, clientId) {
    try {
      const welcomeData = {
        type: 'server:welcome',
        clientId,
        serverInfo: {
          actorSpaceId: this.actorSpace.spaceId,
          dataStoreGuid: 'kg-datastore-actor',
          serverTime: new Date().toISOString(),
          capabilities: [
            'store:add',
            'store:query', 
            'store:get',
            'handle:create',
            'handle:method',
            'subscription:add',
            'subscription:remove'
          ]
        }
      };
      
      websocket.send(JSON.stringify(welcomeData));
      console.log(`📨 Welcome message sent to client ${clientId}`);
      
      // Register client with KGDataStoreActor for notifications
      this._registerClientWithDataStore(clientId, websocket);
      
    } catch (error) {
      console.error(`Error sending welcome message to ${clientId}:`, error);
    }
  }
  
  /**
   * Register client with KGDataStoreActor for change notifications
   * @private
   */
  _registerClientWithDataStore(clientId, websocket) {
    try {
      const clientInfo = this.connectedClients.get(websocket);
      if (!clientInfo) {
        console.error(`No client info found for ${clientId}`);
        return;
      }
      
      // Create sender context for notifications
      const senderContext = {
        sender: {
          guid: clientId,
          receive: (message) => {
            // Send notification directly via WebSocket
            websocket.send(JSON.stringify(message));
            console.log(`📤 Notification sent to client ${clientId}: ${message.type}`);
          }
        },
        clientId: clientId,
        channel: clientInfo.channel
      };
      
      // Send client connect message to KGDataStoreActor using direct reference
      if (this.dataStoreActor) {
        this.dataStoreActor.receive({
          type: 'client:connect',
          payload: { clientId },
          requestId: null // No response needed
        }, senderContext);
        
        console.log(`✅ Client ${clientId} registered with KGDataStoreActor for notifications`);
      } else {
        console.error('KGDataStoreActor not available');
      }
    } catch (error) {
      console.error(`Error registering client ${clientId} with data store:`, error);
    }
  }
  
  /**
   * Handle client disconnection cleanup
   * @private
   */
  _handleClientDisconnection(websocket) {
    const clientInfo = this.connectedClients.get(websocket);
    if (clientInfo) {
      // Notify the data store actor about client disconnection
      try {
        if (this.dataStoreActor) {
          this.dataStoreActor.receive({
            type: 'client:disconnect',
            payload: { clientId: clientInfo.clientId },
            requestId: null
          }, {
            clientId: clientInfo.clientId
          });
          console.log(`📤 Client disconnect sent to KGDataStoreActor for ${clientInfo.clientId}`);
        }
      } catch (error) {
        console.error('Error notifying data store about client disconnect:', error);
      }
      
      // Clean up tracking
      this.connectedClients.delete(websocket);
      console.log(`🧹 Cleaned up client ${clientInfo.clientId}`);
    }
  }
  
  /**
   * Get server statistics
   */
  getStats() {
    const clientStats = Array.from(this.connectedClients.values()).map(client => ({
      clientId: client.clientId,
      connectedAt: client.connectedAt,
      remoteAddress: client.remoteAddress
    }));
    
    return {
      isRunning: this.isRunning,
      port: this.options.port,
      host: this.options.host,
      actorSpaceId: this.actorSpace?.spaceId,
      connectedClients: clientStats.length,
      clients: clientStats,
      dataStore: this.dataStoreActor ? {
        entities: this.dataStoreActor.store.getAllObjects().length,
        handles: this.dataStoreActor.handles.size
      } : null
    };
  }
  
  /**
   * Get the data store actor for direct access
   */
  getDataStoreActor() {
    return this.dataStoreActor;
  }
  
  /**
   * Get the actor space for direct access
   */
  getActorSpace() {
    return this.actorSpace;
  }
  
  /**
   * Stop the server and clean up resources
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Server is not running');
      return;
    }
    
    console.log('Stopping KGDataStoreServer...');
    
    // 1. Close all client connections
    for (const [websocket, clientInfo] of this.connectedClients) {
      try {
        websocket.close(1001, 'Server shutting down');
      } catch (error) {
        console.error(`Error closing client ${clientInfo.clientId}:`, error);
      }
    }
    this.connectedClients.clear();
    
    // 2. Close WebSocket server
    if (this.wsServer) {
      await new Promise((resolve) => {
        this.wsServer.close((error) => {
          if (error) {
            console.error('Error closing WebSocket server:', error);
          } else {
            console.log('✅ WebSocket server closed');
          }
          resolve();
        });
      });
      this.wsServer = null;
    }
    
    // 3. Clean up data store actor
    if (this.dataStoreActor) {
      await this.dataStoreActor.destroy();
      this.dataStoreActor = null;
      console.log('✅ KGDataStoreActor destroyed');
    }
    
    // 4. Clean up actor space
    if (this.actorSpace) {
      this.actorSpace.destroy();
      this.actorSpace = null;
      console.log('✅ ActorSpace destroyed');
    }
    
    this.isRunning = false;
    console.log('🛑 KGDataStoreServer stopped');
  }
}