/**
 * @fileoverview LogWebSocketServer - WebSocket server for real-time log streaming
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class LogWebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.port = options.port || 0;
    this.host = options.host || 'localhost';
    this.legionLogManager = options.legionLogManager;
    
    this.wss = null;
    this.clients = new Map(); // clientId -> client info
    this.subscriptions = new Map(); // clientId -> Set of sessionIds
    this.isRunning = false;
  }
  
  /**
   * Start the WebSocket server
   * @returns {Promise<Object>} Server info
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.port,
          host: this.host
        });
        
        this.wss.on('connection', (ws, request) => {
          this.handleConnection(ws, request);
        });
        
        this.wss.on('listening', () => {
          const address = this.wss.address();
          this.port = address.port;
          this.isRunning = true;
          
          resolve({
            port: this.port,
            host: this.host
          });
        });
        
        this.wss.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {IncomingMessage} request - HTTP request
   */
  handleConnection(ws, request) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const client = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      connectedAt: new Date()
    };
    
    this.clients.set(clientId, client);
    this.subscriptions.set(clientId, new Set());
    
    // Send welcome message
    this.sendToClient(client, {
      type: 'connected',
      clientId,
      timestamp: new Date()
    });
    
    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        this.sendToClient(client, {
          type: 'error',
          data: {
            error: 'Invalid JSON message',
            details: error.message
          }
        });
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.subscriptions.delete(clientId);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
    });
  }
  
  /**
   * Handle message from client
   * @param {Object} client - Client info
   * @param {Object} message - Message from client
   */
  async handleClientMessage(client, message) {
    try {
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(client, message);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscribe(client, message);
          break;
          
        case 'search':
          await this.handleSearch(client, message);
          break;
          
        case 'create-session':
          await this.handleCreateSession(client, message);
          break;
          
        case 'end-session':
          await this.handleEndSession(client, message);
          break;
          
        case 'list-sessions':
          await this.handleListSessions(client, message);
          break;
          
        default:
          this.sendToClient(client, {
            type: 'error',
            data: {
              error: `Unknown message type: ${message.type}`
            }
          });
      }
    } catch (error) {
      this.sendToClient(client, {
        type: 'error',
        data: {
          error: error.message
        }
      });
    }
  }
  
  /**
   * Handle subscription request
   * @param {Object} client - Client info
   * @param {Object} message - Subscribe message
   */
  async handleSubscribe(client, message) {
    const { sessionId, levels = ['error', 'warn', 'info'] } = message;
    
    const clientSubscriptions = this.subscriptions.get(client.id);
    clientSubscriptions.add(sessionId);
    
    // Store subscription details
    client.subscriptions.add({
      sessionId,
      levels: new Set(levels)
    });
    
    this.sendToClient(client, {
      type: 'subscription-confirmed',
      data: {
        sessionId,
        levels
      }
    });
  }
  
  /**
   * Handle unsubscribe request
   * @param {Object} client - Client info
   * @param {Object} message - Unsubscribe message
   */
  async handleUnsubscribe(client, message) {
    const { sessionId } = message;
    
    const clientSubscriptions = this.subscriptions.get(client.id);
    clientSubscriptions.delete(sessionId);
    
    // Remove from client subscriptions
    client.subscriptions = new Set(
      Array.from(client.subscriptions).filter(sub => sub.sessionId !== sessionId)
    );
    
    this.sendToClient(client, {
      type: 'unsubscription-confirmed',
      data: { sessionId }
    });
  }
  
  /**
   * Handle search request
   * @param {Object} client - Client info
   * @param {Object} message - Search message
   */
  async handleSearch(client, message) {
    const { query, sessionId, mode = 'keyword', limit = 100 } = message;
    
    const result = await this.legionLogManager.searchLogs({
      query,
      sessionId,
      mode,
      limit
    });
    
    this.sendToClient(client, {
      type: 'search-result',
      data: result
    });
  }
  
  /**
   * Handle create session request
   * @param {Object} client - Client info
   * @param {Object} message - Create session message
   */
  async handleCreateSession(client, message) {
    const { name, description } = message;
    
    const result = await this.legionLogManager.createSession({
      name,
      description
    });
    
    this.sendToClient(client, {
      type: 'session-created',
      data: result
    });
  }
  
  /**
   * Handle end session request
   * @param {Object} client - Client info
   * @param {Object} message - End session message
   */
  async handleEndSession(client, message) {
    const { sessionId } = message;
    
    const result = await this.legionLogManager.endSession(sessionId);
    
    this.sendToClient(client, {
      type: 'session-ended',
      data: { ...result, sessionId, status: 'completed' }
    });
  }
  
  /**
   * Handle list sessions request
   * @param {Object} client - Client info
   * @param {Object} message - List sessions message
   */
  async handleListSessions(client, message) {
    const result = await this.legionLogManager.listSessions();
    
    this.sendToClient(client, {
      type: 'sessions-list',
      data: result
    });
  }
  
  /**
   * Send message to specific client
   * @param {Object} client - Client info
   * @param {Object} message - Message to send
   */
  sendToClient(client, message) {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast log message to subscribed clients
   * @param {Object} logEntry - Log entry to broadcast
   */
  broadcastLog(logEntry) {
    for (const client of this.clients.values()) {
      // Check if client is subscribed to this session
      const isSubscribed = Array.from(client.subscriptions).some(sub => {
        return sub.sessionId === logEntry.sessionId && 
               sub.levels.has(logEntry.level);
      });
      
      if (isSubscribed) {
        this.sendToClient(client, {
          type: 'log',
          data: logEntry
        });
      }
    }
  }
  
  /**
   * Add client for testing
   * @param {Object} mockClient - Mock client
   */
  addClient(mockClient) {
    this.clients.set(mockClient.id, mockClient);
    this.subscriptions.set(mockClient.id, new Set());
  }
  
  /**
   * Remove client
   * @param {string} clientId - Client ID
   */
  removeClient(clientId) {
    this.clients.delete(clientId);
    this.subscriptions.delete(clientId);
  }
  
  /**
   * Subscribe client to session (for testing)
   * @param {string} clientId - Client ID
   * @param {string} sessionId - Session ID
   */
  subscribe(clientId, sessionId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions = client.subscriptions || new Set();
      client.subscriptions.add({ sessionId, levels: new Set(['error', 'warn', 'info']) });
    }
  }
  
  /**
   * Get number of connected clients
   * @returns {number} Client count
   */
  getClientCount() {
    return this.clients.size;
  }
  
  /**
   * Check if server is running
   * @returns {boolean} True if running
   */
  isRunning() {
    return this.isRunning;
  }
  
  /**
   * Stop the WebSocket server
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}