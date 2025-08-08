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
import { ArtifactActor } from '../agents/ArtifactActor.js';
import { LogCaptureAgent } from '../agents/LogCaptureAgent.js';

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
    },
    { 
      name: 'artifactProcessor',
      frontend: 'ArtifactProcessorActor', 
      backend: 'ArtifactActor',
      interface: 'artifactProcessing',
      provides: ['artifacts_processed', 'artifact_detected'],
      requires: ['process_tool_result']
    },
    { 
      name: 'logCapture',
      frontend: 'LogCaptureActor', 
      backend: 'LogCaptureAgent',
      interface: 'logging',
      provides: ['log_batch_processed', 'frontend_alert'],
      requires: ['log_batch', 'session_metadata', 'log_capture_config']
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
          this.artifactAgent = this.getActor('artifactDebug');
          this.artifactActor = this.getActor('artifactProcessor');
          
          // Wire actor references after all actors are created
          this.wireActorReferences();
          
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
   * Wire actor references after all actors are created
   */
  wireActorReferences() {
    // Give ChatAgent reference to ArtifactActor
    if (this.chatAgent && this.artifactActor) {
      this.chatAgent.setArtifactActor(this.artifactActor);
    }
    
    // Give ChatAgent reference to ArtifactAgent for direct notifications
    if (this.chatAgent && this.artifactAgent) {
      this.chatAgent.setArtifactAgent(this.artifactAgent);
    }
    
    // Give ArtifactActor reference to ArtifactAgent
    if (this.artifactActor && this.artifactAgent) {
      this.artifactActor.setArtifactAgent(this.artifactAgent);
    }
    
    // Give ArtifactAgent reference to ChatAgent (for backwards compatibility)
    if (this.artifactAgent && this.chatAgent) {
      this.artifactAgent.setChatAgent(this.chatAgent);
    }
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
        return this.artifactAgent;
        
      case 'ArtifactActor':
        this.artifactActor = new ArtifactActor(config);
        return this.artifactActor;
        
      case 'LogCaptureAgent':
        this.logCaptureAgent = new LogCaptureAgent(config);
        // Initialize the BT agent to set up the executor
        await this.logCaptureAgent.initialize();
        return this.logCaptureAgent;
        
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