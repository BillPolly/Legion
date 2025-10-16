/**
 * ActorRegistry - Backend actor management
 *
 * Manages actor definitions and instances on the backend.
 * Provides centralized registration and spawning.
 */

import { DeclarativeActor } from '@legion/actors';

export class ActorRegistry {
  constructor() {
    this.definitions = new Map();  // actorId -> { type, config }
    this.instances = new Map();    // actorId -> actor instance
  }

  /**
   * Register actor type
   * @param {string} actorId - Unique identifier for this actor type
   * @param {Function|Object} definition - Actor class or protocol definition
   */
  register(actorId, definition) {
    if (typeof definition === 'function') {
      // Class-based actor
      this.definitions.set(actorId, { type: 'class', class: definition });
    } else if (definition.protocol) {
      // Declarative actor
      this.definitions.set(actorId, { type: 'declarative', protocol: definition.protocol });
    } else {
      throw new Error('Invalid actor definition');
    }
  }

  /**
   * Create instance from registered type
   * @param {string} actorId - ID of registered actor type
   * @param {Object} config - Configuration to pass to actor
   * @returns {Actor} Actor instance
   */
  spawn(actorId, config = {}) {
    const def = this.definitions.get(actorId);
    if (!def) {
      throw new Error(`Actor not registered: ${actorId}`);
    }

    let instance;
    if (def.type === 'class') {
      instance = new def.class(config);
    } else if (def.type === 'declarative') {
      instance = new DeclarativeActor(def.protocol);
    }

    this.instances.set(actorId, instance);
    return instance;
  }

  /**
   * Get existing instance
   * @param {string} actorId - ID of spawned actor
   * @returns {Actor|undefined} Actor instance or undefined
   */
  get(actorId) {
    return this.instances.get(actorId);
  }

  /**
   * List registered types
   * @returns {string[]} Array of registered actor IDs
   */
  listTypes() {
    return Array.from(this.definitions.keys());
  }

  /**
   * List active instances
   * @returns {string[]} Array of spawned actor IDs
   */
  listInstances() {
    return Array.from(this.instances.keys());
  }

  /**
   * Destroy instance
   * @param {string} actorId - ID of actor to destroy
   */
  destroy(actorId) {
    this.instances.delete(actorId);
  }
}
