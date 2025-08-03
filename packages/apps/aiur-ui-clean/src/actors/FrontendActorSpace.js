/**
 * Frontend ActorSpace implementation using the shared actor system
 * Handles the client side of the actor protocol
 */

import { ActorSpace } from '/Legion/shared/actors/src/ActorSpace.js';
import { ChatActor } from './ChatActor.js';

export class FrontendActorSpace extends ActorSpace {
  constructor(spaceId = 'frontend') {
    super(spaceId);
    this.ws = null;
    this.chatActor = null;
    this.serverRootGuid = null;
    this.messageHandlers = new Map(); // For event emitter compatibility
  }
  
  async connect(url = 'ws://localhost:8080/ws') {
    console.log(`FrontendActorSpace: Connecting to ${url}...`);
    
    // Create browser WebSocket
    const ws = new WebSocket(url);
    this.ws = ws;
    
    // Wait for connection to open
    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log('FrontendActorSpace: WebSocket connected');
        resolve();
      };
      ws.onerror = (error) => {
        console.error('FrontendActorSpace: Connection error:', error);
        reject(error);
      };
    });
    
    // Wait for server's handshake message
    return new Promise((resolve) => {
      const handleHandshake = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'actor_handshake') {
            console.log(`FrontendActorSpace: Received handshake with server GUID ${msg.serverRootGuid}`);
            this.serverRootGuid = msg.serverRootGuid;
            
            // Create ChatActor
            const chatActor = new ChatActor();
            const chatGuid = `${this.spaceId}-chat`;
            this.register(chatActor, chatGuid);
            this.chatActor = chatActor;
            
            // Send our root GUID back
            ws.send(JSON.stringify({
              type: 'actor_handshake_ack',
              clientRootGuid: chatGuid
            }));
            
            console.log(`FrontendActorSpace: Sent handshake ACK with GUID ${chatGuid}`);
            
            // Now create Channel - it will take over ws.onmessage
            const channel = this.addChannel(ws);
            
            // Create RemoteActor for server's root and give to ChatActor
            const serverRoot = channel.makeRemote(msg.serverRootGuid);
            chatActor.setRemoteAgent(serverRoot);
            
            console.log('FrontendActorSpace: Actor protocol active');
            
            // Emit connected event for compatibility
            this.emit('connected');
            
            // Resolve the connection promise
            resolve(this);
            
            // Actor protocol now active - Channel handles all messages
          } else {
            // Not a handshake, wait for the right message
            console.log(`FrontendActorSpace: Waiting for handshake, got ${msg.type}`);
            ws.onmessage = handleHandshake;
          }
        } catch (error) {
          console.error('FrontendActorSpace: Error handling handshake:', error);
          ws.onmessage = handleHandshake;
        }
      };
      
      // Listen for handshake
      ws.onmessage = handleHandshake;
    });
  }
  
  // Event emitter compatibility methods for components that expect them
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
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.chatActor && this.chatActor.destroy) {
      this.chatActor.destroy();
    }
    
    this.emit('disconnected');
  }
  
  // Convenience method for terminal actor compatibility
  async callTool(method, params = {}) {
    // This would need to be implemented through actors
    // For now, throw an error to indicate it needs refactoring
    throw new Error('callTool not implemented - use actor protocol instead');
  }
}