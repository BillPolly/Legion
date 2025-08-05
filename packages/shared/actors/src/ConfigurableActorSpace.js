/**
 * ConfigurableActorSpace - Base class for declarative actor wiring
 * 
 * Extends ActorSpace to support automatic actor creation and pairing
 * based on configuration rather than hardcoded logic.
 */

import { ActorSpace } from './ActorSpace.js';

export class ConfigurableActorSpace extends ActorSpace {
  /**
   * @param {string} spaceId - Unique identifier for this actor space
   * @param {Object} actorConfig - Configuration defining actor pairs
   * @param {Object} dependencies - Dependencies to pass to actors (sessionManager, moduleLoader, etc.)
   */
  constructor(spaceId, actorConfig, dependencies = {}) {
    super(spaceId);
    this.actorConfig = actorConfig;
    this.dependencies = dependencies;
    this.actors = new Map(); // name -> actor instance
    this.actorGuids = new Map(); // name -> guid
  }

  /**
   * Setup actors based on configuration
   * @param {string} role - 'frontend' or 'backend' to determine which actors to create
   */
  async setupActors(role = 'frontend') {
    if (!this.actorConfig || !this.actorConfig.actorPairs) {
      throw new Error('Invalid actor configuration: missing actorPairs');
    }

    for (const pair of this.actorConfig.actorPairs) {
      const actorClassName = pair[role];
      
      if (actorClassName) {
        try {
          // Create actor instance
          const actor = await this.createActor(actorClassName, pair.name);
          
          // Generate consistent GUID
          const guid = `${this.spaceId}-${pair.name}`;
          
          // Register with ActorSpace
          this.register(actor, guid);
          
          // Store references
          this.actors.set(pair.name, actor);
          this.actorGuids.set(pair.name, guid);
          
          console.log(`ConfigurableActorSpace: Created ${role} actor '${pair.name}' (${actorClassName}) with GUID ${guid}`);
        } catch (error) {
          console.error(`ConfigurableActorSpace: Failed to create actor '${pair.name}':`, error);
          // Continue with other actors even if one fails
        }
      }
    }
  }

  /**
   * Get handshake data for this actor space
   * @returns {Object} Map of actor names to GUIDs
   */
  getHandshakeData() {
    const data = {};
    for (const [name, guid] of this.actorGuids) {
      data[name] = guid;
    }
    return data;
  }
  
  /**
   * Get enhanced handshake data with interface metadata
   * @returns {Object} Actor metadata including interfaces
   */
  getEnhancedHandshakeData() {
    const actors = {};
    
    for (const pair of this.actorConfig.actorPairs) {
      const actor = this.actors.get(pair.name);
      if (actor) {
        actors[pair.name] = {
          guid: this.actorGuids.get(pair.name),
          type: pair.backend || pair.frontend,
          interface: pair.interface,
          provides: pair.provides || [],
          requires: pair.requires || []
        };
      }
    }
    
    return actors;
  }

  /**
   * Wire actors to their remote counterparts after handshake
   * @param {Channel} channel - The communication channel
   * @param {Object} remoteActorGuids - Map of actor names to remote GUIDs
   */
  wireActors(channel, remoteActorGuids) {
    // Store all remote actors for cross-actor communication
    this.remoteActors = new Map();
    
    for (const [name, remoteGuid] of Object.entries(remoteActorGuids)) {
      if (remoteGuid) {
        const remoteActor = channel.makeRemote(remoteGuid);
        this.remoteActors.set(name, remoteActor);
      }
    }
    
    // Wire each local actor to its corresponding remote actor
    for (const [name, localActor] of this.actors) {
      const remoteActor = this.remoteActors.get(name);
      
      if (remoteActor) {
        // Give it to the local actor
        if (localActor.setRemoteAgent) {
          localActor.setRemoteAgent(remoteActor);
        } else if (localActor.setRemoteActor) {
          localActor.setRemoteActor(remoteActor);
        } else {
          // Store as property for actors that don't have a setter
          localActor.remoteActor = remoteActor;
        }
        
        // Also give reference to all remote actors for cross-communication
        localActor.remoteActors = this.remoteActors;
        
        console.log(`ConfigurableActorSpace: Wired ${name} to remote ${remoteActor.guid}`);
      } else {
        console.warn(`ConfigurableActorSpace: No remote actor found for ${name}`);
      }
    }
  }

  /**
   * Create an actor instance - must be overridden by subclasses
   * @param {string} className - Name of the actor class to create
   * @param {string} name - Logical name of the actor (e.g., 'chat', 'terminal')
   * @returns {Promise<Actor>} The created actor instance
   */
  async createActor(className, name) {
    throw new Error(`Subclass must implement createActor for ${className}`);
  }

  /**
   * Get an actor by name
   * @param {string} name - The actor name from configuration
   * @returns {Actor|null} The actor instance or null if not found
   */
  getActor(name) {
    return this.actors.get(name) || null;
  }

  /**
   * Clean up all actors
   */
  destroy() {
    console.log(`ConfigurableActorSpace: Destroying space ${this.spaceId}`);
    
    // Destroy all actors
    for (const [name, actor] of this.actors) {
      if (actor && actor.destroy) {
        try {
          actor.destroy();
        } catch (error) {
          console.error(`Error destroying actor ${name}:`, error);
        }
      }
    }
    
    // Clear collections
    this.actors.clear();
    this.actorGuids.clear();
    
    // Call parent destroy
    super.destroy();
  }
}