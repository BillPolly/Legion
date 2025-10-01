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
   * Register RemoteHandle class for deserialization
   * Must be called before deserializing Handles
   * @param {class} RemoteHandleClass - RemoteHandle class constructor
   */
  static registerRemoteHandle(RemoteHandleClass) {
    globalThis.__RemoteHandleClass = RemoteHandleClass;
  }

  /**
   * Encodes a JavaScript object into a JSON string, handling Actors and circular references.
   * Uses the ActorSpace's knowledge of local actors.
   * @param {*} obj - The object to encode.
   * @returns {string} The JSON string representation.
   */
  serialize(obj) {
    const visited = new Set(); // Track visited objects to detect cycles

    // Capture actorSpace reference for use in replacer
    const actorSpace = this.actorSpace;

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

      // Add to visited set before processing
      visited.add(value);

      // --- Actor Handling (MUST check BEFORE serialize() for Handles) ---
      if (value?.isActor === true) {
        // Is it an actor *already known* to this space?
        let guid = actorSpace.objectToGuid.get(value);
        if (!guid) {
          // If not known, should we assign a GUID? Only if it's a LocalActor belonging to this space.
          if (!value.isRemote) { // local
            guid = actorSpace._generateGuid();
            actorSpace.objectToGuid.set(value, guid);
            actorSpace.guidToObject.set(guid, value);
          } else if (value.isRemote) {
            // It's a RemoteActorPlaceholder not in our map. This is an error state.
            const logPrefix = `[${actorSpace.spaceId} Serialize Replacer Key: "${key}"]`;
            console.error(`${logPrefix} Error: Encountered unknown RemoteActorPlaceholder! Should have been mapped during deserialize.`, value);
            return null; // Or throw?
          }
        }

        // Check if Actor has custom serialization (like Handle)
        if (guid && typeof value.serialize === 'function') {
          try {
            const customData = value.serialize();
            // Merge Actor GUID with custom serialization data
            return {
              '#actorGuid': guid,
              ...customData
            };
          } catch (error) {
            console.warn(`ActorSerializer: Actor serialize() method failed for key "${key}":`, error.message);
            // Fall back to just GUID
            return { '#actorGuid': guid };
          }
        }

        // Standard Actor serialization (just GUID)
        if (guid) {
          return { '#actorGuid': guid };
        }
      }

      // --- Object Self-Serialization (for non-Actor objects) ---
      // Check if object has a serialize method and delegate to it
      if (typeof value.serialize === 'function') {
        try {
          const serialized = value.serialize();
          return serialized;
        } catch (error) {
          console.warn(`ActorSerializer: Object serialize() method failed for key "${key}":`, error.message);
          // Fall through to default handling
        }
      }

      // Default handling for other objects/arrays
      return value;
    };

    try {
      const encoded = JSON.stringify(obj, replacer);
      return encoded;
    } catch (error) {
      console.error(`ActorSerializer (for ${actorSpace.spaceId}): Serialization failed:`, error);
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
            // Check if this is a RemoteHandle (Handle sent from server)
            if (value.__type === 'RemoteHandle') {
              // Import RemoteHandle dynamically to avoid circular dependencies
              // RemoteHandle is in @legion/handle package
              try {
                // Dynamic import - RemoteHandle should be available
                const RemoteHandle = globalThis.__RemoteHandleClass;

                if (!RemoteHandle) {
                  throw new Error(`RemoteHandle class not available. ` +
                    `Make sure RemoteHandle is imported and registered via ActorSerializer.registerRemoteHandle(). ` +
                    `Received Handle with type '${value.handleType}' and GUID '${guid}'.`);
                }

                // Phase 7: Create RemoteHandle with remote server GUID
                // Note: 'guid' is the server Handle's GUID that RemoteHandle will call
                const remoteHandle = new RemoteHandle(guid, channel, {
                  handleType: value.handleType,
                  schema: value.schema,
                  capabilities: value.capabilities
                });

                // Wrap RemoteHandle in Proxy to forward unknown method calls
                const proxiedHandle = RemoteHandle.createProxy(remoteHandle);

                // Phase 7: Register RemoteHandle with its OWN GUID in client ActorSpace
                // Generate new GUID for RemoteHandle in this ActorSpace
                // NOTE: Register BOTH the proxy AND the original remoteHandle with the same GUID
                // so that lookups work whether using the proxy or the original
                const clientGuid = this.actorSpace._generateGuid();
                this.actorSpace.guidToObject.set(clientGuid, proxiedHandle);  // Register proxy for message routing
                this.actorSpace.objectToGuid.set(remoteHandle, clientGuid);   // Register original for GUID lookup
                this.actorSpace.objectToGuid.set(proxiedHandle, clientGuid);  // Register proxy for GUID lookup

                // Return the proxied handle to the user
                return proxiedHandle;
              } catch (error) {
                console.error('Failed to create RemoteHandle:', error);
                throw error;
              }
            }

            // Unknown GUID, this must be a standard remote actor new to this space.
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
