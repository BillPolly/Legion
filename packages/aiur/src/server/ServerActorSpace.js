/**
 * ServerActorSpace - Backend actor space for Aiur server
 * 
 * Each WebSocket connection gets its own ServerActorSpace instance
 * with its own ChatAgent for handling chat communication
 */

import { ActorSpace } from '../../../shared/actors/src/ActorSpace.js';
import { ChatAgent } from '../agents/ChatAgent.js';

export class ServerActorSpace extends ActorSpace {
  constructor(spaceId = 'server') {
    super(spaceId);
    this.clientId = null;
    this.chatAgent = null;
    this.clientRootGuid = null;
  }

  /**
   * Handle a new WebSocket connection
   * Sends the first handshake message with our root actor GUID
   */
  handleConnection(ws, clientId) {
    console.log(`ServerActorSpace: New connection from ${clientId}`);
    this.clientId = clientId;
    
    // Create ChatAgent for this connection
    const chatAgent = new ChatAgent({ sessionId: this.spaceId });
    const chatGuid = `${this.spaceId}-chat`;
    this.register(chatAgent, chatGuid);
    this.chatAgent = chatAgent;
    
    // Send FIRST message with our root actor GUID
    ws.send(JSON.stringify({
      type: 'actor_handshake',
      serverRootGuid: chatGuid
    }));
    
    console.log(`ServerActorSpace: Sent handshake with GUID ${chatGuid}`);
    
    // Handle handshake response BEFORE giving to Channel
    const handleHandshake = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'actor_handshake_ack') {
          console.log(`ServerActorSpace: Received handshake ACK with client GUID ${msg.clientRootGuid}`);
          this.clientRootGuid = msg.clientRootGuid;
          
          // Now create Channel - it will take over ws message handling
          const channel = this.addChannel(ws);
          
          // Create RemoteActor for client's root and give to ChatAgent
          const clientRoot = channel.makeRemote(msg.clientRootGuid);
          chatAgent.remoteActor = clientRoot;
          
          console.log(`ServerActorSpace: Actor protocol active for ${clientId}`);
          
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
   * Clean up when connection closes
   */
  destroy() {
    console.log(`ServerActorSpace: Destroying space ${this.spaceId}`);
    
    if (this.chatAgent && this.chatAgent.destroy) {
      this.chatAgent.destroy();
    }
    
    // Clear all actors
    this.guidToObject.clear();
    this.objectToGuid.clear();
  }
}