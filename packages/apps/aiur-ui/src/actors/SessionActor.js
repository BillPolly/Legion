import { Actor } from '/Legion/shared/actors/src/Actor.js';
import { ChatActor } from './ChatActor.js';
import { TerminalActor } from './TerminalActor.js';

/**
 * SessionActor - Top-level frontend actor that manages multiple child actors
 * This is the root actor that coordinates Chat and Terminal actors over a single WebSocket
 */
export class SessionActor extends Actor {
  constructor() {
    super();
    
    // Child actors
    this.chatActor = null;
    this.terminalActor = null;
    
    // Remote session agent reference
    this.remoteSessionAgent = null;
    
    // Actor registry for routing
    this.childActors = new Map(); // name -> actor instance
    
    console.log('SessionActor: Created');
  }
  
  /**
   * Initialize child actors
   */
  initializeChildren(terminal = null) {
    // Create ChatActor
    this.chatActor = new ChatActor();
    this.childActors.set('chat', this.chatActor);
    
    // Create TerminalActor
    this.terminalActor = new TerminalActor(terminal);
    this.childActors.set('terminal', this.terminalActor);
    
    console.log('SessionActor: Child actors initialized');
  }
  
  /**
   * Set remote session agent reference after handshake
   */
  setRemoteSessionAgent(remoteAgent) {
    this.remoteSessionAgent = remoteAgent;
    
    // Create proxy remote actors for children to use
    this.setupChildRemoteActors();
    
    console.log('SessionActor: Connected to remote session agent');
  }
  
  /**
   * Setup remote actor proxies for child actors
   */
  setupChildRemoteActors() {
    // Create proxy remote actors that route through this session actor
    const chatRemoteProxy = this.createChildRemoteProxy('chat');
    const terminalRemoteProxy = this.createChildRemoteProxy('terminal');
    
    // Give proxies to child actors
    this.chatActor.setRemoteAgent(chatRemoteProxy);
    this.terminalActor.setRemoteAgent(terminalRemoteProxy);
    
    console.log('SessionActor: Child remote actor proxies setup');
  }
  
  /**
   * Create a remote actor proxy for a child actor
   */
  createChildRemoteProxy(childName) {
    return {
      receive: (payload) => {
        // Route child actor messages through session layer
        const sessionMessage = {
          target: childName,
          data: payload
        };
        
        console.log(`SessionActor: Routing ${childName} message to remote:`, sessionMessage);
        
        if (this.remoteSessionAgent) {
          this.remoteSessionAgent.receive(sessionMessage);
        } else {
          console.error('SessionActor: No remote session agent connected');
        }
      }
    };
  }
  
  /**
   * Receive messages from remote session agent
   */
  receive(payload, envelope) {
    console.log('SessionActor: Received message:', payload);
    
    // Route messages to appropriate child actor
    if (payload.target && this.childActors.has(payload.target)) {
      const childActor = this.childActors.get(payload.target);
      console.log(`SessionActor: Routing to ${payload.target} actor`);
      childActor.receive(payload.data, envelope);
    } else {
      console.error('SessionActor: Unknown target or missing target:', payload.target);
    }
  }
  
  /**
   * Get child actor by name
   */
  getChildActor(name) {
    return this.childActors.get(name);
  }
  
  /**
   * Get all child actors
   */
  getChildActors() {
    return Array.from(this.childActors.values());
  }
  
  /**
   * Check if connected to remote session
   */
  isConnected() {
    return this.remoteSessionAgent !== null;
  }
  
  /**
   * Disconnect from remote session
   */
  disconnect() {
    this.remoteSessionAgent = null;
    
    // Disconnect child actors
    if (this.chatActor && this.chatActor.disconnect) {
      this.chatActor.disconnect();
    }
    
    if (this.terminalActor && this.terminalActor.disconnect) {
      this.terminalActor.disconnect();
    }
    
    console.log('SessionActor: Disconnected');
  }
  
  /**
   * Destroy the session actor and all children
   */
  destroy() {
    this.disconnect();
    
    // Destroy child actors
    if (this.chatActor && this.chatActor.destroy) {
      this.chatActor.destroy();
    }
    
    if (this.terminalActor && this.terminalActor.destroy) {
      this.terminalActor.destroy();
    }
    
    // Clear references
    this.childActors.clear();
    this.chatActor = null;  
    this.terminalActor = null;
    
    console.log('SessionActor: Destroyed');
  }
}