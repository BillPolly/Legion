/**
 * Handles serialization and deserialization of objects, with special handling
 * for Actors, within the context of an ActorSpace.
 */
export class ActorSerializer {
  /**
   * @param {import('./ActorSpace.js').default} actorSpace - The ActorSpace instance this serializer is bound to.
   */
  constructor(actorSpace) {
    this.actorSpace = actorSpace;
  }

  /**
   * Encodes a JavaScript object into a JSON string, handling Actors and circular references.
   * Uses the ActorSpace's knowledge of local actors.
   * @param {*} obj - The object to encode.
   * @returns {string} The JSON string representation.
   */
  serialize(obj) {
    const visited = new Set(); // Track visited objects to detect cycles

    const replacer = (key, value) => {
      // Handle non-object types or null directly
      if (typeof value !== 'object' || value === null) {
        return value;
      }

      // --- Circular Reference Handling (moved up to check first) ---
      if (visited.has(value)) {
        console.warn(`ActorSerializer: Circular reference detected for key "${key}", object type: ${value?.constructor?.name || typeof value}, object keys: ${Object.keys(value || {}).slice(0, 5).join(',')}`);
        return '[Circular]'; // Simple marker for circular refs
      }

      // --- Object Self-Serialization ---
      // Check if object has a serialize method and delegate to it
      // Do this BEFORE adding to visited set to avoid circular detection on serialized result
      if (typeof value.serialize === 'function') {
        try {
          const serialized = value.serialize();
          // Don't add the original object to visited set since we're returning its serialized form
          return serialized;
        } catch (error) {
          console.warn(`ActorSerializer: Object serialize() method failed for key "${key}":`, error.message);
          // Fall through to default handling
        }
      }

      // Add to visited set only after trying serialize method
      visited.add(value);

      // --- Actor Handling ---
      if (value?.isActor === true) {
        // Is it an actor *already known* to this space?
        let guid = this.actorSpace.objectToGuid.get(value);
        if (guid) {
          // Yes, return its GUID reference
          return { '#actorGuid': guid };
        } else {
          // If not known, should we assign a GUID? Only if it's a LocalActor belonging to this space.
          if (!value.isRemote) { // local
            guid = this.actorSpace._generateGuid();
            this.actorSpace.objectToGuid.set(value, guid);
            this.actorSpace.guidToObject.set(guid, value);
            return { '#actorGuid': guid };
          } else if (value.isRemote) {
            // It's a RemoteActorPlaceholder not in our map. This is an error state.
            const logPrefix = `[${this.actorSpace.spaceId} Serialize Replacer Key: "${key}"]`;
            console.error(`${logPrefix} Error: Encountered unknown RemoteActorPlaceholder! Should have been mapped during deserialize.`, value);
            return null; // Or throw?
          }
        }
      }
      // If it's not an actor OR it's an unknown LocalActor passed as data OR a known RemoteActorPlaceholder, proceed.

      // Default handling for other objects/arrays
      return value;
    };

    try {
      const encoded = JSON.stringify(obj, replacer);
      return encoded;
    } catch (error) {
      console.error(`ActorSerializer (for ${this.actorSpace.spaceId}): Serialization failed:`, error);
      throw error;
    } finally {
      visited.clear(); // Clear after top-level stringify finishes
    }
  }

  /**
   * Decodes a JSON string back into a JavaScript object, reconstructing Actors.
   * Uses the ActorSpace's knowledge and registers remote actors/channels.
   * @param {string} str - The JSON string to decode.
   * @param {import('./Channel.js').Channel} [channel] - The channel this message arrived on (needed to map new remote actors).
   * @returns {*} The decoded JavaScript object or value.
   */
  deserialize(str, channel) {
    const reviver = (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // Handle resource handle reconstruction
        if (value.__type === 'ResourceHandle') {
          if (!value.handleId || !value.resourceType || !value.methodSignatures) {
            throw new Error('Invalid resource handle data: missing required fields');
          }
          
          // Get the resource client actor to create the proxy
          const resourceClient = this.actorSpace.guidToObject.get('resource-client-sub');
          if (!resourceClient) {
            throw new Error('ResourceClientSubActor not found for handle reconstruction');
          }
          
          return resourceClient.createProxyFromData(value);
        }
        
        // Handle actor GUID reconstruction (existing logic)
        if (value.hasOwnProperty('#actorGuid')) {
          const guid = value['#actorGuid'];
          const existingObj = this.actorSpace.guidToObject.get(guid);

          if (existingObj) {
            // Known GUID. Return the existing local actor or remote placeholder
            return existingObj;
          } else {
            // Unknown GUID, this must be a remote actor new to this space.
            // The channel is crucial here to correctly associate the remote actor.
            if (!channel) {
              console.error(`ActorSerializer (for ${this.actorSpace.spaceId}): Deserialization of new remote actor GUID ${guid} failed. Source channel not provided.`);
              // Potentially return a generic placeholder or throw, depending on desired strictness.
              // For now, let's assume makeRemote can handle a null/undefined channel if it's a general policy.
              // However, the original ActorSpace.decode always expected a channel for this case.
              // This indicates that 'channel' should ideally not be optional if new remote actors are possible.
            }
            return this.actorSpace.makeRemote(guid, channel);
          }
        }
      }
      return value;
    };

    try {
      const decoded = JSON.parse(str, reviver);
      return decoded;
    } catch (error) {
      console.error(`ActorSerializer (for ${this.actorSpace.spaceId}): Deserialization failed:`, error, "Input string:", str);
      throw error;
    }
  }
}
