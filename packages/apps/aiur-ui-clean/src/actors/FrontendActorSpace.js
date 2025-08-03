/**
 * Frontend ActorSpace implementation using the shared actor system
 * This replaces ClientActorSpace with proper actor protocol
 */

import { ActorSpace } from '../../../../shared/actors/src/ActorSpace.js';
import { WebSocketManager } from './WebSocketManager.js';

export class FrontendActorSpace extends ActorSpace {
  constructor(spaceId = 'frontend') {
    super(spaceId);
    this.wsManager = null;
    this.sessionId = null;
    this.clientId = null;
    this.serverChatGuid = null; // Will be set by server
    this.messageHandlers = new Map(); // For event emitter compatibility
  }
  
  async connect(url = 'ws://localhost:8080/ws') {
    console.log(`FrontendActorSpace: Connecting to ${url}...`);
    
    // Create WebSocket manager
    this.wsManager = new WebSocketManager(url);
    
    // Set up WebSocket event handlers
    this.wsManager.on('message', (event) => this.handleRawMessage(event));
    this.wsManager.on('open', () => this.handleWebSocketOpen());
    this.wsManager.on('close', () => this.handleWebSocketClose());
    this.wsManager.on('error', (error) => this.handleWebSocketError(error));
    
    // Connect
    await this.wsManager.connect();
    
    // Create channel for actor communication
    // The WebSocket needs to be wrapped to match the Channel's expected interface
    const wsWrapper = {
      send: (data) => this.wsManager.send(data),
      onmessage: null,
      onclose: null,
      onerror: null,
      onopen: null
    };
    
    // Forward WebSocket events to the wrapper
    this.wsManager.on('message', (event) => {
      if (wsWrapper.onmessage) wsWrapper.onmessage(event);
    });
    
    // Add the channel
    this.channel = this.addChannel(wsWrapper);
    
    return this;
  }
  
  handleRawMessage(event) {
    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      console.log(`FrontendActorSpace: Received raw message:`, message);
      
      // Handle server messages before actor protocol messages
      switch (message.type) {
        case 'welcome':
          this.handleWelcomeMessage(message);
          break;
          
        case 'session_created':
          this.handleSessionCreated(message);
          break;
          
        case 'actor_space_ready':
          this.handleActorSpaceReady(message);
          break;
          
        case 'chat_response':
        case 'chat_stream':
        case 'chat_error':
        case 'chat_processing':
        case 'chat_complete':
        case 'chat_history':
        case 'chat_history_cleared':
          // These are chat messages from the server
          this.routeChatMessage(message);
          break;
          
        default:
          // Let the actor system handle it if it has targetGuid
          if (message.targetGuid) {
            // This is an actor protocol message, let the Channel handle it
            // The channel's onmessage handler will decode and route it
            return;
          }
          
          // Otherwise emit as generic message
          this.emit('message', message);
      }
      
    } catch (error) {
      console.error('FrontendActorSpace: Error handling message:', error);
    }
  }
  
  handleWelcomeMessage(message) {
    this.clientId = message.clientId;
    console.log(`FrontendActorSpace: Connected as client ${this.clientId}`);
    
    // Create a session automatically
    this.createSession();
  }
  
  handleSessionCreated(message) {
    if (message.success) {
      this.sessionId = message.sessionId;
      console.log(`FrontendActorSpace: Session created: ${this.sessionId}`);
      
      // Notify listeners that session is ready
      this.emit('session_ready', { sessionId: this.sessionId });
    }
  }
  
  handleActorSpaceReady(message) {
    console.log(`FrontendActorSpace: Actor space ready from server`, message);
    
    // Store the server's ChatAgent GUID
    this.serverChatGuid = message.serverActorGuid;
    
    // The server expects us to use this GUID for our ChatActor
    const expectedGuid = message.expectingClientGuid;
    
    // Update our ChatActor's GUID to match what server expects
    const chatActor = this.guidToObject.get('chat');
    if (chatActor) {
      // Re-register with the expected GUID
      this.guidToObject.delete('chat');
      this.register(chatActor, expectedGuid);
      
      // Create RemoteActor for the server's ChatAgent
      if (this.channel && this.serverChatGuid) {
        const remoteChatAgent = this.channel.makeRemote(this.serverChatGuid);
        chatActor.setRemoteAgent(remoteChatAgent);
        console.log(`FrontendActorSpace: Connected ChatActor to server ChatAgent`);
      }
    }
    
    this.emit('actor_space_ready', message);
  }
  
  routeChatMessage(message) {
    // Find the chat actor and deliver the message
    const chatActor = Array.from(this.guidToObject.values()).find(
      actor => actor.constructor.name === 'ChatActor'
    );
    
    if (chatActor) {
      chatActor.receive(message);
    } else {
      console.warn('FrontendActorSpace: No ChatActor registered to handle message');
    }
    
    // Also emit for general handling
    this.emit('chat_message', message);
  }
  
  async createSession() {
    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        type: 'session_create',
        requestId,
        params: {
          metadata: {
            client: 'aiur-ui-clean',
            version: '1.0.0'
          }
        }
      };
      
      this.wsManager.send(message);
      
      // Wait for session_created response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for session creation'));
        }, 5000);
        
        const handler = (msg) => {
          if (msg.sessionId) {
            clearTimeout(timeout);
            this.off('session_ready', handler);
            resolve(msg);
          }
        };
        
        this.on('session_ready', handler);
      });
    } catch (error) {
      console.error('FrontendActorSpace: Failed to create session:', error);
      throw error;
    }
  }
  
  handleWebSocketOpen() {
    console.log('FrontendActorSpace: WebSocket connected');
    this.emit('connected');
  }
  
  handleWebSocketClose() {
    console.log('FrontendActorSpace: WebSocket disconnected');
    this.sessionId = null;
    this.clientId = null;
    this.serverChatGuid = null;
    this.emit('disconnected');
  }
  
  handleWebSocketError(error) {
    console.error('FrontendActorSpace: WebSocket error:', error);
    this.emit('error', error);
  }
  
  // Event emitter compatibility methods
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
        console.error(`FrontendActorSpace: Error in ${event} handler:`, error);
      }
    });
  }
  
  // Convenience method for calling tools (backwards compatibility)
  async callTool(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('No active session. Create a session first.');
    }
    
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      type: 'tool_request',
      requestId,
      method,
      params,
      sessionId: this.sessionId
    };
    
    console.log(`[FrontendActorSpace] Calling tool: ${method}`, params);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for tool response: ${method}`));
      }, 30000);
      
      const handler = (msg) => {
        if (msg.requestId === requestId) {
          clearTimeout(timeout);
          this.off('tool_response', handler);
          
          if (msg.error) {
            reject(new Error(msg.error.message || msg.error));
          } else {
            resolve(msg.result || msg);
          }
        }
      };
      
      this.on('tool_response', handler);
      this.wsManager.send(message);
    });
  }
  
  disconnect() {
    if (this.wsManager) {
      this.wsManager.disconnect();
    }
  }
}