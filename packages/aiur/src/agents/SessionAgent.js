import { Actor } from '../../../shared/actors/src/Actor.js';
import { ChatAgent } from './ChatAgent.js';
import { TerminalAgent } from './TerminalAgent.js';

/**
 * SessionAgent - Top-level backend agent that manages multiple child agents
 * This is the root agent that coordinates Chat and Terminal agents over a single WebSocket
 */
export class SessionAgent extends Actor {
  constructor(config = {}) {
    super();
    
    // Session identification
    this.sessionId = config.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Child agents
    this.chatAgent = null;
    this.terminalAgent = null;
    
    // Remote session actor reference  
    this.remoteSessionActor = null;
    
    // Agent registry for routing
    this.childAgents = new Map(); // name -> agent instance
    
    // Aiur integration
    this.moduleManager = config.moduleManager || null;
    this.toolRegistry = config.toolRegistry || null;
    
    console.log(`SessionAgent: Created for session ${this.sessionId}`);
  }
  
  /**
   * Initialize child agents
   */
  initializeChildren() {
    // Create ChatAgent
    this.chatAgent = new ChatAgent({
      sessionId: this.sessionId,
      remoteActor: null // Will be set via proxy
    });
    this.childAgents.set('chat', this.chatAgent);
    
    // Create TerminalAgent with Aiur integration
    this.terminalAgent = new TerminalAgent({
      sessionId: this.sessionId,
      moduleManager: this.moduleManager,
      toolRegistry: this.toolRegistry,
      remoteActor: null // Will be set via proxy
    });
    this.childAgents.set('terminal', this.terminalAgent);
    
    console.log('SessionAgent: Child agents initialized');
  }
  
  /**
   * Set remote session actor reference after handshake
   */
  setRemoteSessionActor(remoteActor) {
    this.remoteSessionActor = remoteActor;
    
    // Create proxy remote actors for children to use
    this.setupChildRemoteActors();
    
    console.log('SessionAgent: Connected to remote session actor');
  }
  
  /**
   * Setup remote actor proxies for child agents
   */
  setupChildRemoteActors() {
    // Create proxy remote actors that route through this session agent
    const chatRemoteProxy = this.createChildRemoteProxy('chat');
    const terminalRemoteProxy = this.createChildRemoteProxy('terminal');
    
    // Give proxies to child agents
    this.chatAgent.remoteActor = chatRemoteProxy;
    this.terminalAgent.remoteActor = terminalRemoteProxy;
    
    console.log('SessionAgent: Child remote actor proxies setup');
  }
  
  /**
   * Create a remote actor proxy for a child agent
   */
  createChildRemoteProxy(childName) {
    return {
      receive: (payload) => {
        // Route child agent messages through session layer
        const sessionMessage = {
          target: childName,
          data: payload
        };
        
        console.log(`SessionAgent: Routing ${childName} message to remote:`, sessionMessage);
        
        if (this.remoteSessionActor) {
          this.remoteSessionActor.receive(sessionMessage);
        } else {
          console.error('SessionAgent: No remote session actor connected');
        }
      }
    };
  }
  
  /**
   * Receive messages from remote session actor
   */
  receive(payload, envelope) {
    console.log('SessionAgent: Received message:', payload);
    
    // Route messages to appropriate child agent
    if (payload.target && this.childAgents.has(payload.target)) {
      const childAgent = this.childAgents.get(payload.target);
      console.log(`SessionAgent: Routing to ${payload.target} agent`);
      childAgent.receive(payload.data, envelope);
    } else {
      console.error('SessionAgent: Unknown target or missing target:', payload.target);
    }
  }
  
  /**
   * Get child agent by name
   */
  getChildAgent(name) {
    return this.childAgents.get(name);
  }
  
  /**
   * Get all child agents
   */
  getChildAgents() {
    return Array.from(this.childAgents.values());
  }
  
  /**
   * Check if connected to remote session
   */
  isConnected() {
    return this.remoteSessionActor !== null;
  }
  
  /**
   * Disconnect from remote session
   */
  disconnect() {
    this.remoteSessionActor = null;
    
    // Disconnect child agents
    if (this.chatAgent && this.chatAgent.disconnect) {
      this.chatAgent.disconnect();
    }
    
    if (this.terminalAgent && this.terminalAgent.disconnect) {
      this.terminalAgent.disconnect();
    }
    
    console.log('SessionAgent: Disconnected');
  }
  
  /**
   * Destroy the session agent and all children
   */
  destroy() {
    this.disconnect();
    
    // Destroy child agents
    if (this.chatAgent && this.chatAgent.destroy) {
      this.chatAgent.destroy();
    }
    
    if (this.terminalAgent && this.terminalAgent.destroy) {
      this.terminalAgent.destroy();
    }
    
    // Clear references
    this.childAgents.clear();
    this.chatAgent = null;
    this.terminalAgent = null;
    
    console.log(`SessionAgent: Destroyed session ${this.sessionId}`);
  }
}