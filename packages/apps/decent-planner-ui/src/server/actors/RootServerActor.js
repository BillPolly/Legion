/**
 * RootServerActor - Top-level server actor coordinating sub-actors
 * Manages PlannerServerSubActor and ChatServerSubActor
 */

import PlannerServerSubActor from './PlannerServerSubActor.js';
import ChatServerSubActor from './ChatServerSubActor.js';

export default class RootServerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.actorSpace = null;
    
    // Sub-actors
    this.plannerSubActor = null;
    this.chatSubActor = null;
    
    this.isReady = false;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Root server actor connected');
    
    try {
      // Initialize sub-actors first
      await this.initializeSubActors();
      
      // Send ready signal
      this.remoteActor.receive('ready', {
        timestamp: new Date().toISOString()
      });
      
      this.isReady = true;
      
    } catch (error) {
      console.error('Failed to initialize root server actor - FULL ERROR:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      this.remoteActor.receive('error', {
        message: error.message || 'Unknown error during root server actor initialization',
        name: error.name,
        stack: error.stack
      });
    }
  }

  // Method to be called by the server framework to provide ActorSpace
  setActorSpace(actorSpace) {
    this.actorSpace = actorSpace;
    console.log('🎭 Root server actor got ActorSpace reference');
  }


  async initializeSubActors() {
    console.log('Initializing sub-actors...');
    
    // Initialize sub-actors
    this.plannerSubActor = new PlannerServerSubActor(this.services);
    this.chatSubActor = new ChatServerSubActor(this.services);
    
    // Set parent references
    this.plannerSubActor.setParentActor(this);
    this.chatSubActor.setParentActor(this);
    
    // Register sub-actors in the ActorSpace if we have it
    if (this.actorSpace) {
      this.actorSpace.register(this.plannerSubActor, 'planner-server-sub');
      this.actorSpace.register(this.chatSubActor, 'chat-server-sub');
      
      // Create remote references for direct communication
      const remotePlannerClient = this.actorSpace.makeRemote('planner-client-sub');
      const remoteChatClient = this.actorSpace.makeRemote('chat-client-sub');
      
      // Set remote actors for direct communication
      await this.plannerSubActor.setRemoteActor(remotePlannerClient);
      await this.chatSubActor.setRemoteActor(remoteChatClient);
    } else {
      console.warn('No ActorSpace reference available for sub-actor registration');
      // Fallback to parent-mediated communication
      await this.plannerSubActor.setRemoteActor(this.remoteActor);
      await this.chatSubActor.setRemoteActor(this.remoteActor);
    }
    
    console.log('✅ Sub-actors initialized');
  }

  receive(messageType, data) {
    console.log('📨 Root server received:', messageType);
    
    switch (messageType) {
      case 'ping':
        this.remoteActor.receive('pong', { timestamp: Date.now() });
        break;
        
      default:
        // Route messages to appropriate sub-actor based on prefix
        if (messageType.startsWith('planner-') && this.plannerSubActor) {
          this.plannerSubActor.receive(messageType.replace('planner-', ''), data);
        } else if (messageType.startsWith('chat-') && this.chatSubActor) {
          this.chatSubActor.receive(messageType.replace('chat-', ''), data);
        } else {
          // Default routing - try planner first for backward compatibility
          if (this.plannerSubActor) {
            this.plannerSubActor.receive(messageType, data);
          } else {
            console.warn('Unknown message type in root server actor:', messageType);
          }
        }
        break;
    }
  }

  // Method for sub-actors to send messages to their client counterparts
  sendToSubActor(subActorType, messageType, data) {
    if (this.remoteActor) {
      const prefixedMessageType = `${subActorType}-${messageType}`;
      this.remoteActor.receive(prefixedMessageType, data);
    }
  }
}