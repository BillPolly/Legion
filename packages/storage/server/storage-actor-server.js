/**
 * Storage Actor Server
 * WebSocket server for Actor-based storage communication
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ActorProtocolHandler } from './ActorProtocolHandler.js';
import { StorageActorHost } from './StorageActorHost.js';

export class StorageActorServer {
  constructor(config = {}) {
    const { resourceManager, port, path } = config;
    
    // Load configuration from ResourceManager if available
    if (resourceManager) {
      this.resourceManager = resourceManager;
      this.port = resourceManager.env.STORAGE_ACTOR_PORT || port || 3700;
      this.path = resourceManager.env.STORAGE_ACTOR_PATH || path || '/storage';
    } else {
      this.port = port || 3700;
      this.path = path || '/storage';
    }
    
    this.wss = null;
    this.httpServer = null;
    this.isRunning = false;
    this.connections = new Map();
    this.protocolHandler = null;
    this.actorHost = null;
  }

  async start() {
    try {
      // Create HTTP server for WebSocket upgrade
      this.httpServer = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({
        port: this.port,
        path: this.path
      });

      // Initialize protocol handler and actor host
      this.protocolHandler = new ActorProtocolHandler();
      this.actorHost = new StorageActorHost(this.resourceManager);
      await this.actorHost.initialize();

      // Set up connection handling
      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });

      this.isRunning = true;
      console.log(`Storage Actor Server running on ws://localhost:${this.port}${this.path}`);
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    console.log(`New actor connection: ${connectionId}`);

    // Store connection
    this.connections.set(connectionId, {
      ws,
      subscriptions: new Set()
    });

    // Set up message handling
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(connectionId, message);
      } catch (error) {
        this.sendError(ws, null, error.message);
      }
    });

    ws.on('close', () => {
      console.log(`Actor connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`Connection error ${connectionId}:`, error);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      connectionId,
      timestamp: Date.now()
    });
  }

  async handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Process message through protocol handler
      const response = await this.protocolHandler.processMessage(
        message,
        this.actorHost
      );

      // Send response
      if (response) {
        this.sendMessage(connection.ws, response);
      }
    } catch (error) {
      this.sendError(connection.ws, message.id, error.message);
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, requestId, errorMessage) {
    this.sendMessage(ws, {
      type: 'error',
      id: requestId,
      error: {
        message: errorMessage,
        timestamp: Date.now()
      }
    });
  }

  generateConnectionId() {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown() {
    if (!this.isRunning) return;

    console.log('Shutting down Storage Actor Server...');
    
    // Close all client connections
    for (const [id, connection] of this.connections) {
      connection.ws.close();
    }
    this.connections.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss.close(() => resolve());
      });
    }

    // Cleanup actor host
    if (this.actorHost) {
      await this.actorHost.cleanup();
    }

    this.isRunning = false;
    console.log('Storage Actor Server shutdown complete');
  }
}