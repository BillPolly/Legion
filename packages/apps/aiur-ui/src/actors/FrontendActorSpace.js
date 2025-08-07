/**
 * Frontend ActorSpace implementation using the shared actor system
 * Handles the client side of the actor protocol
 */

import { ConfigurableActorSpace } from '/Legion/shared/actors/src/ConfigurableActorSpace.js';
import { ChatActor } from './ChatActor.js';
import { TerminalActor } from './TerminalActor.js';
import { ArtifactDebugActor } from './ArtifactDebugActor.js';

// Default actor configuration with interface declarations
const DEFAULT_ACTOR_CONFIG = {
  actorPairs: [
    { 
      name: 'chat', 
      frontend: 'ChatActor', 
      backend: 'ChatAgent',
      interface: 'chat',
      provides: ['chat_message', 'clear_history'],
      requires: ['chat_response', 'chat_stream', 'chat_history']
    },
    { 
      name: 'terminal', 
      frontend: 'TerminalActor', 
      backend: 'TerminalAgent',
      interface: 'terminal',
      provides: ['terminal_input', 'execute_tool'],
      requires: ['terminal_output', 'tool_list']
    },
    { 
      name: 'artifactDebug', 
      frontend: 'ArtifactDebugActor', 
      backend: 'ArtifactAgent',
      interface: 'artifacts',
      provides: ['get_artifacts', 'clear_artifacts'],
      requires: ['artifact_created', 'artifact_updated', 'artifacts_list']
    }
  ]
};

export class FrontendActorSpace extends ConfigurableActorSpace {
  constructor(spaceId = 'frontend', actorConfig = DEFAULT_ACTOR_CONFIG) {
    super(spaceId, actorConfig);
    this.ws = null;
    this.serverActorGuids = {}; // Will store server's actor GUIDs
    this.messageHandlers = new Map(); // For event emitter compatibility
    this.terminal = null; // Terminal reference for TerminalActor
  }
  
  async connect(url = 'ws://localhost:8080/ws', terminal = null) {
    console.log(`FrontendActorSpace: Connecting to ${url}...`);
    
    // Store terminal reference for actor creation
    this.terminal = terminal;
    
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
    
    // Setup actors based on configuration
    await this.setupActors('frontend');
    
    // Wait for server's handshake message
    return new Promise((resolve) => {
      const handleHandshake = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'actor_handshake') {
            console.log(`FrontendActorSpace: Received handshake with server actor GUIDs:`, msg.serverActors);
            this.serverActorGuids = msg.serverActors;
            
            // Send our actor GUIDs back
            ws.send(JSON.stringify({
              type: 'actor_handshake_ack',
              clientActors: this.getHandshakeData()
            }));
            
            console.log(`FrontendActorSpace: Sent handshake ACK with actor GUIDs`);
            
            // Now create Channel - it will take over ws.onmessage
            const channel = this.addChannel(ws);
            
            // Wire all actors to their remote counterparts
            this.wireActors(channel, msg.serverActors);
            
            console.log('FrontendActorSpace: Actor protocol active with multiple actors');
            
            // Keep references for backwards compatibility
            this.chatActor = this.getActor('chat');
            this.terminalActor = this.getActor('terminal');
            
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
  
  /**
   * Create an actor instance based on class name
   * @param {string} className - Name of the actor class to create
   * @param {string} name - Logical name of the actor
   * @returns {Promise<Actor>} The created actor instance
   */
  async createActor(className, name) {
    switch (className) {
      case 'ChatActor':
        return new ChatActor();
        
      case 'TerminalActor':
        return new TerminalActor(this.terminal);
        
      case 'ArtifactDebugActor':
        // Will be created when we implement it
        return new ArtifactDebugActor();
        
      default:
        throw new Error(`Unknown frontend actor class: ${className}`);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Parent class handles actor cleanup
    this.destroy();
    
    this.emit('disconnected');
  }
  
  // Convenience method for terminal actor compatibility
  async callTool(method, params = {}) {
    // This would need to be implemented through actors
    // For now, throw an error to indicate it needs refactoring
    throw new Error('callTool not implemented - use actor protocol instead');
  }
}