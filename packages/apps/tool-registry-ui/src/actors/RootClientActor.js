/**
 * RootClientActor - Root-level actor that manages all client-side sub-actors
 * Provides a generic pattern for sub-actor registration and connection management
 */

export class RootClientActor {
  constructor() {
    this.subActors = new Map();
    this.remoteActor = null;
    this.connections = new Map();
    this.clientId = `client-${Date.now()}`;
    this.handshakeComplete = false;
    this.availableServerSubActors = [];
  }

  /**
   * Register a sub-actor with a name
   * @param {string} name - The name/type of the sub-actor
   * @param {Object} actor - The actor instance
   */
  registerSubActor(name, actor) {
    this.subActors.set(name, actor);
    console.log(`✅ Registered client sub-actor: ${name}`);
  }

  /**
   * Set the remote root actor for communication
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  /**
   * Initiate handshake with server root actor
   */
  async initiateHandshake(requestedSubActors = []) {
    console.log('🤝 Initiating root actor handshake...');
    
    await this.sendMessage('root:handshake', {
      clientId: this.clientId,
      requestedSubActors: requestedSubActors.length > 0 
        ? requestedSubActors 
        : Array.from(this.subActors.keys())
    });
    
    // Wait for handshake acknowledgment
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Root handshake timeout'));
      }, 10000);
      
      this.handshakeResolver = (success) => {
        clearTimeout(timeout);
        if (success) {
          resolve();
        } else {
          reject(new Error('Root handshake failed'));
        }
      };
    });
  }

  /**
   * Handle incoming messages from the server root actor
   */
  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'root:handshake_ack':
          await this.handleHandshakeAck(data);
          break;
          
        case 'root:subactor_connected':
          await this.handleSubActorConnected(data);
          break;
          
        case 'root:subactors_list':
          await this.handleSubActorsList(data);
          break;
          
        case 'root:forward':
          await this.handleForward(data);
          break;
          
        case 'root:error':
          await this.handleError(data);
          break;
          
        default:
          // If not a root message, try to route to sub-actor
          await this.routeToSubActor(message);
      }
    } catch (error) {
      console.error(`Error processing ${type}:`, error);
    }
  }

  /**
   * Handle handshake acknowledgment from server
   */
  async handleHandshakeAck(data) {
    const { serverId, availableSubActors } = data;
    
    console.log(`✅ Root handshake complete with server: ${serverId}`);
    console.log(`📋 Available server sub-actors:`, availableSubActors);
    
    this.availableServerSubActors = availableSubActors;
    this.handshakeComplete = true;
    
    // Resolve handshake promise
    if (this.handshakeResolver) {
      this.handshakeResolver(true);
      this.handshakeResolver = null;
    }
    
    // Automatically connect matching sub-actors
    await this.connectMatchingSubActors();
  }

  /**
   * Connect client sub-actors to their server counterparts
   */
  async connectMatchingSubActors() {
    for (const [name, actor] of this.subActors) {
      if (this.availableServerSubActors.includes(name)) {
        await this.connectSubActor(name);
      }
    }
  }

  /**
   * Connect a specific sub-actor to its server counterpart
   */
  async connectSubActor(name) {
    const subActor = this.subActors.get(name);
    if (!subActor) {
      console.error(`Sub-actor not found: ${name}`);
      return;
    }
    
    const subActorId = `${this.clientId}-${name}`;
    
    // Request connection to server sub-actor
    await this.sendMessage('root:connect_subactor', {
      subActorName: name,
      clientSubActorId: subActorId
    });
    
    // Create a proxy for the remote sub-actor
    const remoteSubActor = {
      send: async (message) => {
        await this.sendMessage('root:forward', {
          targetName: name,
          message
        });
      }
    };
    
    // Connect the sub-actor to its remote counterpart
    if (subActor.setRemoteActor) {
      subActor.setRemoteActor(remoteSubActor);
    }
    
    console.log(`🔗 Requesting connection for sub-actor: ${name}`);
  }

  /**
   * Handle sub-actor connection confirmation
   */
  async handleSubActorConnected(data) {
    const { subActorName, connectionId, status } = data;
    
    if (status === 'connected') {
      this.connections.set(subActorName, connectionId);
      console.log(`✅ Sub-actor connected: ${subActorName} (${connectionId})`);
      
      // Notify the sub-actor that it's connected
      const subActor = this.subActors.get(subActorName);
      if (subActor && subActor.onConnected) {
        await subActor.onConnected();
      }
    }
  }

  /**
   * Handle list of available server sub-actors
   */
  async handleSubActorsList(data) {
    const { subActors } = data;
    console.log('📋 Server sub-actors:', subActors);
    this.availableServerSubActors = subActors.map(sa => sa.name);
  }

  /**
   * Forward a message to a specific sub-actor
   */
  async handleForward(data) {
    const { targetId, message } = data;
    
    // Extract sub-actor name from targetId
    const name = targetId.split('-').pop();
    
    const subActor = this.subActors.get(name);
    if (subActor && subActor.receive) {
      await subActor.receive(message);
    }
  }

  /**
   * Handle error messages from server
   */
  async handleError(data) {
    console.error('❌ Root actor error:', data.error);
    if (data.details) {
      console.error('Details:', data.details);
    }
  }

  /**
   * Route a message to the appropriate sub-actor based on message type
   */
  async routeToSubActor(message) {
    const { type } = message;
    
    // Extract sub-actor name from message type (e.g., "planning:complete" -> "planning")
    const subActorName = type.split(':')[0];
    
    const subActor = this.subActors.get(subActorName);
    if (subActor && subActor.receive) {
      await subActor.receive(message);
    } else {
      console.warn(`No handler for message type: ${type}`);
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
   * Request list of available server sub-actors
   */
  async requestSubActorsList() {
    await this.sendMessage('root:list_subactors', {});
  }

  /**
   * Check if a server sub-actor is available
   */
  isServerSubActorAvailable(name) {
    return this.availableServerSubActors.includes(name);
  }

  /**
   * Clean up all sub-actor connections
   */
  async cleanup() {
    console.log('🧹 Cleaning up client root actor connections...');
    
    // Notify all sub-actors of disconnect
    for (const [name, actor] of this.subActors) {
      if (actor.cleanup) {
        await actor.cleanup();
      }
    }
    
    // Clear connections
    this.connections.clear();
    this.remoteActor = null;
    this.handshakeComplete = false;
  }
}