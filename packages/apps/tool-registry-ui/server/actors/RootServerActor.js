/**
 * RootServerActor - Root-level actor that manages all server-side sub-actors
 * Provides a generic pattern for sub-actor registration and connection management
 */

export class RootServerActor {
  constructor() {
    this.subActors = new Map();
    this.remoteActor = null;
    this.connections = new Map();
  }

  /**
   * Register a sub-actor with a name
   * @param {string} name - The name/type of the sub-actor
   * @param {Object} actor - The actor instance
   */
  registerSubActor(name, actor) {
    this.subActors.set(name, actor);
    console.log(`✅ Registered sub-actor: ${name}`);
  }

  /**
   * Set the remote root actor for communication
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  /**
   * Handle incoming messages from the client root actor
   */
  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'root:handshake':
          await this.handleHandshake(data);
          break;
          
        case 'root:connect_subactor':
          await this.handleSubActorConnection(data);
          break;
          
        case 'root:list_subactors':
          await this.handleListSubActors();
          break;
          
        case 'root:forward':
          await this.handleForward(data);
          break;
          
        default:
          // If not a root message, try to route to sub-actor
          await this.routeToSubActor(message);
      }
    } catch (error) {
      await this.sendError(`Error processing ${type}: ${error.message}`, error);
    }
  }

  /**
   * Handle initial handshake with client root actor
   */
  async handleHandshake(data) {
    const { clientId, requestedSubActors } = data;
    
    console.log(`🤝 Root handshake from client: ${clientId}`);
    
    // Get available sub-actors that the client requested
    const availableSubActors = [];
    for (const name of (requestedSubActors || [])) {
      if (this.subActors.has(name)) {
        availableSubActors.push(name);
      }
    }
    
    // If no specific sub-actors requested, provide all available
    const subActorList = availableSubActors.length > 0 
      ? availableSubActors 
      : Array.from(this.subActors.keys());
    
    // Send handshake acknowledgment with available sub-actors
    await this.sendMessage('root:handshake_ack', {
      serverId: `server-${Date.now()}`,
      availableSubActors: subActorList,
      timestamp: new Date()
    });
  }

  /**
   * Handle sub-actor connection request
   */
  async handleSubActorConnection(data) {
    const { subActorName, clientSubActorId } = data;
    
    const subActor = this.subActors.get(subActorName);
    if (!subActor) {
      await this.sendError(`Sub-actor not found: ${subActorName}`);
      return;
    }
    
    // Create a connection mapping
    const connectionId = `${subActorName}-${clientSubActorId}`;
    this.connections.set(connectionId, {
      serverActor: subActor,
      clientId: clientSubActorId
    });
    
    // Create a proxy for the remote sub-actor
    const remoteSubActor = {
      send: async (message) => {
        await this.sendMessage('root:forward', {
          targetId: clientSubActorId,
          message
        });
      }
    };
    
    // Connect the sub-actor to its remote counterpart
    if (subActor.setRemoteActor) {
      subActor.setRemoteActor(remoteSubActor);
    }
    
    // Acknowledge connection
    await this.sendMessage('root:subactor_connected', {
      subActorName,
      connectionId,
      status: 'connected'
    });
    
    console.log(`🔗 Connected sub-actor: ${subActorName} -> ${clientSubActorId}`);
  }

  /**
   * List all available sub-actors
   */
  async handleListSubActors() {
    const subActorInfo = Array.from(this.subActors.entries()).map(([name, actor]) => ({
      name,
      type: actor.constructor.name,
      available: true
    }));
    
    await this.sendMessage('root:subactors_list', {
      subActors: subActorInfo
    });
  }

  /**
   * Forward a message to a specific sub-actor
   */
  async handleForward(data) {
    const { targetName, message } = data;
    
    const subActor = this.subActors.get(targetName);
    if (!subActor) {
      await this.sendError(`Cannot forward to unknown sub-actor: ${targetName}`);
      return;
    }
    
    // Forward the message to the sub-actor
    if (subActor.receive) {
      await subActor.receive(message);
    }
  }

  /**
   * Route a message to the appropriate sub-actor based on message type
   */
  async routeToSubActor(message) {
    const { type } = message;
    
    // Extract sub-actor name from message type (e.g., "planning:create" -> "planning")
    const subActorName = type.split(':')[0];
    
    const subActor = this.subActors.get(subActorName);
    if (subActor && subActor.receive) {
      await subActor.receive(message);
    } else {
      await this.sendError(`No handler for message type: ${type}`);
    }
  }

  /**
   * Send a message to the remote root actor
   */
  async sendMessage(type, data) {
    if (this.remoteActor) {
      await this.remoteActor.send({ type, data });
    }
  }

  /**
   * Send an error message
   */
  async sendError(error, details = null) {
    await this.sendMessage('root:error', {
      error,
      details: details || {},
      timestamp: new Date()
    });
  }

  /**
   * Clean up all sub-actor connections
   */
  async cleanup() {
    console.log('🧹 Cleaning up root actor connections...');
    
    // Notify all sub-actors of disconnect
    for (const [name, actor] of this.subActors) {
      if (actor.cleanup) {
        await actor.cleanup();
      }
    }
    
    // Clear connections
    this.connections.clear();
    this.remoteActor = null;
  }
}