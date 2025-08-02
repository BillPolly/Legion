import { WebSocketManager } from './WebSocketManager.js';
import { createRequest, validateMessage, toolMethods } from '../schemas/messages.js';

/**
 * Client-side ActorSpace for managing actors and WebSocket communication
 */
export class ClientActorSpace {
  constructor() {
    this.spaceId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.actors = new Map();
    this.wsManager = null;
    this.channel = null;
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    this.sessionId = null;
    this.clientId = null;
  }
  
  async connect(url = 'ws://localhost:8080/ws') {
    console.log(`ClientActorSpace: Connecting to ${url}...`);
    
    // Create WebSocket manager
    this.wsManager = new WebSocketManager(url);
    
    // Set up WebSocket event handlers
    this.wsManager.on('message', (event) => this.handleWebSocketMessage(event));
    this.wsManager.on('open', () => this.handleWebSocketOpen());
    this.wsManager.on('close', () => this.handleWebSocketClose());
    this.wsManager.on('error', (error) => this.handleWebSocketError(error));
    
    // Connect
    await this.wsManager.connect();
    
    // Create channel wrapper for actor communication
    this.channel = {
      send: (data) => this.wsManager.send(data),
      endpoint: this.wsManager.ws
    };
    
    return this;
  }
  
  registerActor(actor, name) {
    if (!name) {
      name = `actor-${this.actors.size}`;
    }
    
    actor.actorSpace = this;
    actor.name = name;
    actor.guid = `${this.spaceId}:${name}`;
    
    this.actors.set(name, actor);
    console.log(`ClientActorSpace: Registered actor ${name} with guid ${actor.guid}`);
    
    return actor;
  }
  
  getActor(name) {
    return this.actors.get(name);
  }
  
  sendRequest(type, params = {}) {
    try {
      const request = createRequest(type, params);
      
      // Validate outgoing message
      const validation = validateMessage(request, false);
      if (!validation.valid) {
        console.error('ClientActorSpace: Invalid outgoing message:', validation.error);
        return Promise.reject(new Error(validation.error));
      }
      
      console.log(`ClientActorSpace: Sending ${type} request:`, request);
      
      // Store pending request for response tracking
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(request.requestId);
          reject(new Error(`Timeout waiting for response to ${request.requestId}`));
        }, 30000);
        
        this.pendingRequests.set(request.requestId, {
          resolve,
          reject,
          timeout,
          type
        });
        
        this.wsManager.send(request);
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  // Send tool request to server
  async callTool(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('No active session. Create a session first.');
    }
    
    console.log(`[ClientActorSpace] Calling tool: ${method}`, params);
    const response = await this.sendRequest('tool_request', {
      method,
      params
    });
    console.log(`[ClientActorSpace] Tool response for ${method}:`, response);
    return response;
  }
  
  handleWebSocketMessage(event) {
    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      console.log(`ClientActorSpace: Received message:`, message);
      
      // Validate incoming message
      const validation = validateMessage(message, true);
      if (!validation.valid) {
        console.warn('ClientActorSpace: Invalid incoming message:', validation.error, message);
      }
      
      // Handle different message types
      switch (message.type) {
        case 'welcome':
          this.handleWelcomeMessage(message);
          break;
          
        case 'session_created':
          this.handleSessionCreated(message);
          break;
          
        case 'tool_response':
          this.handleToolResponse(message);
          break;
          
        case 'error':
          this.handleErrorMessage(message);
          break;
          
        case 'pong':
          // Handle pong response if needed
          console.log('ClientActorSpace: Received pong');
          break;
          
        default:
          // Unknown message type, emit for actors to handle
          this.emit('message', message);
      }
      
    } catch (error) {
      console.error('ClientActorSpace: Error handling message:', error);
    }
  }
  
  handleWelcomeMessage(message) {
    this.clientId = message.clientId;
    console.log(`ClientActorSpace: Connected as client ${this.clientId}`);
    
    // Create a session automatically
    this.createSession();
  }
  
  handleSessionCreated(message) {
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);
      
      if (message.success) {
        this.sessionId = message.sessionId;
        console.log(`ClientActorSpace: Session created: ${this.sessionId}`);
        pending.resolve(message);
        
        // Notify actors that session is ready
        this.emit('session_ready', { sessionId: this.sessionId });
      } else {
        pending.reject(new Error('Failed to create session'));
      }
    }
  }
  
  handleToolResponse(message) {
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);
      
      if (message.error) {
        // Better error handling - check for error in different places
        const errorMsg = message.error.message || message.error || 'Tool execution failed';
        pending.reject(new Error(errorMsg));
      } else if (message.result && message.result.error) {
        // Sometimes error is nested in result
        pending.reject(new Error(message.result.error));
      } else {
        // Resolve with the full message result
        pending.resolve(message.result || message);
      }
    }
    
    // Also emit for actors to handle
    this.emit('tool_response', message);
  }
  
  handleErrorMessage(message) {
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);
      pending.reject(new Error(message.error.message));
    } else {
      // General error not tied to a request
      console.error('ClientActorSpace: Server error:', message.error);
      this.emit('error', message.error);
    }
  }
  
  handleWebSocketOpen() {
    console.log('ClientActorSpace: WebSocket connected');
    this.emit('connected');
    // Server will send welcome message, then we create session
  }
  
  async createSession() {
    try {
      const response = await this.sendRequest('session_create', {
        metadata: {
          client: 'aiur-ui-clean',
          version: '1.0.0'
        }
      });
      return response;
    } catch (error) {
      console.error('ClientActorSpace: Failed to create session:', error);
      throw error;
    }
  }
  
  handleWebSocketClose() {
    console.log('ClientActorSpace: WebSocket disconnected');
    this.sessionId = null;
    this.clientId = null;
    this.emit('disconnected');
    
    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket disconnected'));
    });
    this.pendingRequests.clear();
  }
  
  handleWebSocketError(error) {
    console.error('ClientActorSpace: WebSocket error:', error);
    this.emit('error', error);
  }
  
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }
  
  off(event, handler) {
    if (!this.messageHandlers.has(event)) return;
    
    const handlers = this.messageHandlers.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
  
  emit(event, ...args) {
    if (!this.messageHandlers.has(event)) return;
    
    const handlers = this.messageHandlers.get(event);
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`ClientActorSpace: Error in ${event} handler:`, error);
      }
    });
  }
  
  disconnect() {
    if (this.wsManager) {
      this.wsManager.disconnect();
    }
  }
}