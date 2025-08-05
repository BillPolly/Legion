/**
 * ServerActorSpace - Backend actor space for Aiur server
 * 
 * Each WebSocket connection gets its own ServerActorSpace instance
 * with its own SessionAgent for handling multi-actor communication
 */

import { ConfigurableActorSpace } from '../../../shared/actors/src/ConfigurableActorSpace.js';
import { ChatAgent } from '../agents/ChatAgent.js';
import { TerminalAgent } from '../agents/TerminalAgent.js';
import { ArtifactAgent } from '../agents/ArtifactAgent.js';

// Actor configuration with interface declarations
const actorConfig = {
  actorPairs: [
    { 
      name: 'chat', 
      frontend: 'ChatActor', 
      backend: 'ChatAgent',
      interface: 'chat',
      provides: ['chat_response', 'chat_stream', 'chat_history'],
      requires: ['chat_message', 'clear_history']
    },
    { 
      name: 'terminal', 
      frontend: 'TerminalActor', 
      backend: 'TerminalAgent',
      interface: 'terminal',
      provides: ['terminal_output', 'tool_list'],
      requires: ['terminal_input', 'execute_tool']
    },
    { 
      name: 'artifactDebug', 
      frontend: 'ArtifactDebugActor', 
      backend: 'ArtifactAgent',
      interface: 'artifacts',
      provides: ['artifact_created', 'artifact_updated', 'artifacts_list'],
      requires: ['get_artifacts', 'clear_artifacts']
    }
  ]
};

export class ServerActorSpace extends ConfigurableActorSpace {
  constructor(spaceId = 'server', config = {}) {
    // Pass actor configuration to parent
    super(spaceId, actorConfig, config);
    
    this.clientId = null;
    this.clientActorGuids = {};
  }

  /**
   * Handle a new WebSocket connection
   * Sends the first handshake message with our actor GUIDs
   */
  async handleConnection(ws, clientId) {
    console.log(`ServerActorSpace: New connection from ${clientId}`);
    this.clientId = clientId;
    
    // Setup actors based on configuration
    await this.setupActors('backend');
    
    // Send FIRST message with our actor GUIDs
    ws.send(JSON.stringify({
      type: 'actor_handshake',
      serverActors: this.getHandshakeData()
    }));
    
    console.log(`ServerActorSpace: Sent handshake with actor GUIDs`);
    
    // Handle handshake response BEFORE giving to Channel
    const handleHandshake = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'actor_handshake_ack') {
          console.log(`ServerActorSpace: Received handshake ACK with client actor GUIDs:`, msg.clientActors);
          this.clientActorGuids = msg.clientActors;
          
          // Now create Channel - it will take over ws message handling
          const channel = this.addChannel(ws);
          
          // Wire all actors to their remote counterparts
          this.wireActors(channel, msg.clientActors);
          
          console.log(`ServerActorSpace: Actor protocol active for ${clientId} with multiple actors`);
          
          // Keep references for backwards compatibility
          this.chatAgent = this.getActor('chat');
          this.terminalAgent = this.getActor('terminal');
          
          // Proactively send initial data to actors
          this.sendInitialData();
          
          // Actor protocol now active - Channel handles all messages
        } else {
          // Not a handshake, wait for the right message
          console.log(`ServerActorSpace: Waiting for handshake ACK, got ${msg.type}`);
          ws.once('message', handleHandshake);
        }
      } catch (error) {
        console.error('ServerActorSpace: Error handling handshake:', error);
        ws.once('message', handleHandshake);
      }
    };
    
    // Listen for handshake response
    ws.once('message', handleHandshake);
  }
  
  /**
   * Send initial data to connected actors
   */
  sendInitialData() {
    // Send initial tools list to terminal
    if (this.terminalAgent) {
      this.terminalAgent.sendInitialTools();
    }
    
    // Chat agent could send initial greeting or status
    if (this.chatAgent) {
      // chatAgent could send welcome message if needed
    }
  }
  
  /**
   * Create an actor instance based on class name
   * @param {string} className - Name of the actor class to create
   * @param {string} name - Logical name of the actor
   * @returns {Promise<Actor>} The created actor instance
   */
  async createActor(className, name) {
    const config = {
      sessionId: this.spaceId,
      sessionManager: this.dependencies.sessionManager,
      moduleLoader: this.dependencies.moduleLoader,
      resourceManager: this.dependencies.resourceManager,
      artifactManager: this.dependencies.artifactManager
    };
    
    switch (className) {
      case 'ChatAgent':
        this.chatAgent = new ChatAgent(config);
        return this.chatAgent;
        
      case 'TerminalAgent':
        return new TerminalAgent({
          sessionManager: this.dependencies.sessionManager,
          moduleLoader: this.dependencies.moduleLoader
        });
        
      case 'ArtifactAgent':
        this.artifactAgent = new ArtifactAgent(config);
        // Connect to ChatAgent for internal artifact events
        if (this.chatAgent) {
          this.artifactAgent.setChatAgent(this.chatAgent);
          // Tell ChatAgent about ArtifactAgent
          this.chatAgent.setArtifactAgent(this.artifactAgent);
        }
        return this.artifactAgent;
        
      default:
        throw new Error(`Unknown backend actor class: ${className}`);
    }
  }
  
  /**
   * Clean up when connection closes
   */
  destroy() {
    // Parent class handles actor cleanup
    super.destroy();
  }
}