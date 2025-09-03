/**
 * ActorSpaceManager
 * Manages actor spaces and their lifecycle for WebSocket connections
 */

import { ActorSpace } from '@legion/actors';
import { ServerToolRegistryActor } from '../actors/ServerToolRegistryActor.js';
import { ServerSemanticSearchActor } from '../actors/ServerSemanticSearchActor.js';

export class ActorSpaceManager {
  constructor(registryService) {
    this.registryService = registryService;
    this.actorSpaces = new Map();
    this.actorCount = 0;
  }
  
  /**
   * Create a new actor space for a connection
   */
  async createActorSpace(connectionId) {
    console.log(`🎭 Creating actor space for ${connectionId}`);
    
    // Create new ActorSpace
    const actorSpace = new ActorSpace(`server-${connectionId}`);
    
    // Create actors with unique GUIDs
    const registryActor = new ServerToolRegistryActor(this.registryService);
    const searchActor = new ServerSemanticSearchActor(this.registryService);
    
    // Register actors with consistent naming
    const actorPrefix = `server-${connectionId}`;
    actorSpace.register(registryActor, `${actorPrefix}-registry`);
    actorSpace.register(searchActor, `${actorPrefix}-search`);
    
    // Store actor space
    this.actorSpaces.set(connectionId, {
      space: actorSpace,
      actors: {
        registry: registryActor,
        search: searchActor
      },
      createdAt: new Date()
    });
    
    this.actorCount += 2;
    
    console.log(`  ✅ Created 2 actors for ${connectionId}`);
    console.log(`  📊 Total actors: ${this.actorCount}`);
    
    return actorSpace;
  }
  
  /**
   * Setup remote actors for a connection
   */
  setupRemoteActors(connectionId, channel, clientActors) {
    const spaceInfo = this.actorSpaces.get(connectionId);
    if (!spaceInfo) {
      throw new Error(`No actor space found for ${connectionId}`);
    }
    
    // Create remote actors for each client actor
    const remoteActors = {};
    for (const [key, guid] of Object.entries(clientActors)) {
      remoteActors[key] = channel.makeRemote(guid);
    }
    
    // Connect server actors to their remote counterparts
    if (remoteActors.registry && spaceInfo.actors.registry) {
      spaceInfo.actors.registry.setRemoteActor(remoteActors.registry);
    }
    
    if (remoteActors.search && spaceInfo.actors.search) {
      spaceInfo.actors.search.setRemoteActor(remoteActors.search);
    }
    
    console.log(`  🔗 Connected ${Object.keys(remoteActors).length} remote actors`);
    
    return remoteActors;
  }
  
  /**
   * Get actor space for a connection
   */
  getActorSpace(connectionId) {
    const spaceInfo = this.actorSpaces.get(connectionId);
    return spaceInfo ? spaceInfo.space : null;
  }
  
  /**
   * Get all actor GUIDs for a connection
   */
  getActorGuids(connectionId) {
    const space = this.getActorSpace(connectionId);
    if (!space) {
      return {};
    }
    
    // Get all registered actor GUIDs from guidToObject Map
    const guids = {};
    const actors = space.guidToObject;
    
    // Map friendly names to GUIDs
    for (const [guid, actor] of actors) {
      // Extract the actor type from GUID (e.g., "server-conn-123-registry" -> "registry")
      const parts = guid.split('-');
      const actorType = parts[parts.length - 1];
      guids[actorType] = guid;
    }
    
    return guids;
  }
  
  /**
   * Cleanup actor space for a connection
   */
  async cleanupActorSpace(connectionId) {
    const spaceInfo = this.actorSpaces.get(connectionId);
    if (!spaceInfo) {
      return;
    }
    
    console.log(`  🧹 Cleaning up actor space for ${connectionId}`);
    
    // Cleanup each actor
    for (const actor of Object.values(spaceInfo.actors)) {
      if (actor && typeof actor.cleanup === 'function') {
        await actor.cleanup();
      }
    }
    
    // Remove from map
    this.actorSpaces.delete(connectionId);
    this.actorCount -= 2;
    
    console.log(`  ✅ Cleaned up 2 actors`);
    console.log(`  📊 Remaining actors: ${this.actorCount}`);
  }
  
  /**
   * Get statistics about actor spaces
   */
  getStats() {
    const spaces = Array.from(this.actorSpaces.values());
    
    return {
      totalSpaces: spaces.length,
      totalActors: this.actorCount,
      spaces: spaces.map(space => ({
        createdAt: space.createdAt,
        duration: Date.now() - space.createdAt.getTime(),
        actors: Object.keys(space.actors)
      }))
    };
  }
  
  /**
   * Cleanup all actor spaces
   */
  async cleanup() {
    console.log('  🎭 Cleaning up all actor spaces...');
    
    for (const connectionId of this.actorSpaces.keys()) {
      await this.cleanupActorSpace(connectionId);
    }
    
    console.log('  ✅ All actor spaces cleaned up');
  }
}