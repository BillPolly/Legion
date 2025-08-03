/**
 * ServerActorSpace - Backend actor space for Aiur server
 * 
 * Manages backend actors and WebSocket connections using the shared actor system
 */

import { ActorSpace } from '../../../shared/actors/src/ActorSpace.js';
import { ChatAgent } from '../agents/ChatAgent.js';

export class ServerActorSpace extends ActorSpace {
  constructor(spaceId = 'server') {
    super(spaceId);
    this.sessions = new Map(); // sessionId -> actors map
    this.connections = new Map(); // ws -> session info
  }

  /**
   * Handle a new WebSocket connection
   * Creates a channel and sets up actors for this connection
   */
  handleConnection(ws, clientId) {
    console.log(`ServerActorSpace: New connection from ${clientId}`);
    
    // Create a channel for this WebSocket
    const channel = this.addChannel(ws);
    
    // Create session-specific actors
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionActors = new Map();
    
    // Create a RemoteActor reference for the frontend ChatActor
    // The frontend will tell us its GUID, but we can create a placeholder
    const remoteChatActorGuid = `client-chat-${sessionId}`;
    const remoteChatActor = channel.makeRemote(remoteChatActorGuid);
    
    // Create and register ChatAgent for this session with remote actor reference
    const chatAgent = new ChatAgent({ 
      sessionId,
      remoteActor: remoteChatActor  // Pass the remote actor reference
    });
    const chatGuid = `${this.spaceId}-chat-${sessionId}`;
    this.register(chatAgent, chatGuid);
    sessionActors.set('chat', chatAgent);
    
    // Store session info
    this.sessions.set(sessionId, sessionActors);
    this.connections.set(ws, { 
      sessionId, 
      clientId, 
      channel,
      chatGuid,
      remoteChatActorGuid
    });
    
    // Send welcome message with actor GUIDs
    ws.send(JSON.stringify({
      type: 'actor_space_ready',
      sessionId,
      serverActorGuid: chatGuid,  // Tell frontend our ChatAgent GUID
      expectingClientGuid: remoteChatActorGuid  // Tell frontend what GUID to use
    }));
    
    // Handle WebSocket close
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });
    
    return sessionId;
  }
  
  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(ws) {
    const connection = this.connections.get(ws);
    if (connection) {
      console.log(`ServerActorSpace: Disconnection for session ${connection.sessionId}`);
      
      // Clean up actors
      const sessionActors = this.sessions.get(connection.sessionId);
      if (sessionActors) {
        // Destroy session actors
        sessionActors.forEach(actor => {
          if (actor.destroy) {
            actor.destroy();
          }
        });
        this.sessions.delete(connection.sessionId);
      }
      
      // Remove connection
      this.connections.delete(ws);
    }
  }
  
  /**
   * Get actors for a specific session
   */
  getSessionActors(sessionId) {
    return this.sessions.get(sessionId);
  }
}