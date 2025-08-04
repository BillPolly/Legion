/**
 * ServerActorSpace - Backend actor space for Aiur server
 * 
 * Each WebSocket connection gets its own ServerActorSpace instance
 * with its own SessionAgent for handling multi-actor communication
 */

import { ActorSpace } from '../../../shared/actors/src/ActorSpace.js';
import { ChatAgent } from '../agents/ChatAgent.js';
import { TerminalAgent } from '../agents/TerminalAgent.js';

export class ServerActorSpace extends ActorSpace {
  constructor(spaceId = 'server', config = {}) {
    super(spaceId);
    this.clientId = null;
    this.chatAgent = null;
    this.terminalAgent = null;
    this.clientActorGuids = {};
    
    // Aiur integration for TerminalAgent
    this.sessionManager = config.sessionManager || null;
    this.moduleLoader = config.moduleLoader || null;
  }

  /**
   * Handle a new WebSocket connection
   * Sends the first handshake message with our actor GUIDs
   */
  handleConnection(ws, clientId) {
    console.log(`ServerActorSpace: New connection from ${clientId}`);
    this.clientId = clientId;
    
    // Create ChatAgent for this connection
    const chatAgent = new ChatAgent({ sessionId: this.spaceId });
    const chatGuid = `${this.spaceId}-chat`;
    this.register(chatAgent, chatGuid);
    this.chatAgent = chatAgent;
    
    // Create TerminalAgent for this connection
    const terminalAgent = new TerminalAgent({ 
      sessionManager: this.sessionManager,
      moduleLoader: this.moduleLoader
    });
    const terminalGuid = `${this.spaceId}-terminal`;
    this.register(terminalAgent, terminalGuid);
    this.terminalAgent = terminalAgent;
    
    // Send FIRST message with our actor GUIDs
    ws.send(JSON.stringify({
      type: 'actor_handshake',
      serverActors: {
        chat: chatGuid,
        terminal: terminalGuid
      }
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
          
          // Create RemoteActors for client's actors
          const remoteChatActor = channel.makeRemote(msg.clientActors.chat);
          const remoteTerminalActor = channel.makeRemote(msg.clientActors.terminal);
          
          // Give RemoteActors to our agents
          chatAgent.remoteActor = remoteChatActor;
          terminalAgent.remoteActor = remoteTerminalActor;
          
          console.log(`ServerActorSpace: Actor protocol active for ${clientId} with multiple actors`);
          
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
   * Clean up when connection closes
   */
  destroy() {
    console.log(`ServerActorSpace: Destroying space ${this.spaceId}`);
    
    if (this.chatAgent && this.chatAgent.destroy) {
      this.chatAgent.destroy();
    }
    
    if (this.terminalAgent && this.terminalAgent.destroy) {
      this.terminalAgent.destroy();
    }
    
    // Clear all actors
    this.guidToObject.clear();
    this.objectToGuid.clear();
  }
}