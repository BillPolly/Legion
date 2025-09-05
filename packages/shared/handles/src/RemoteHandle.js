/**
 * RemoteHandle - Proxy for remote handle instances
 * 
 * Created by ActorSerializer when a BaseHandle is received from a remote actor.
 * Provides the same interface as the original handle but forwards all method
 * calls through the actor system.
 */

export class RemoteHandle {
  constructor(serializedData, actorChannel) {
    if (!serializedData || !serializedData.handleId) {
      throw new Error('RemoteHandle requires serialized data with handleId');
    }
    
    if (!actorChannel) {
      throw new Error('RemoteHandle requires actor channel for communication');
    }
    
    this.handleId = serializedData.handleId;
    this.handleType = serializedData.handleType;
    this.data = serializedData.data || {};
    this.actorChannel = actorChannel;
    this.isRemoteHandle = true;
    
    // Restore attributes
    this.attributes = new Map();
    if (serializedData.attributes) {
      Object.entries(serializedData.attributes).forEach(([key, value]) => {
        this.attributes.set(key, value);
      });
    }
  }

  /**
   * Get TypeHandle for introspection (same as BaseHandle)
   * @returns {TypeHandle|null} Type metadata handle
   */
  get type() {
    if (typeof global.TypeHandleRegistry === 'undefined') {
      throw new Error('TypeHandleRegistry not available - ensure it is imported');
    }
    
    return global.TypeHandleRegistry.getTypeHandle(this.handleType);
  }

  /**
   * Get attribute (same interface as BaseHandle)
   * @param {string} name - Attribute name
   * @returns {any} Attribute value
   */
  getAttribute(name) {
    return this.attributes.get(name);
  }

  /**
   * Set attribute (same interface as BaseHandle)
   * Note: This will send a message to the remote handle
   * @param {string} name - Attribute name
   * @param {any} value - Attribute value
   */
  setAttribute(name, value) {
    this.attributes.set(name, value);
    
    // Forward to remote handle
    this.actorChannel.sendMessage('set-attribute', {
      handleId: this.handleId,
      attribute: name,
      value: value
    });
  }

  /**
   * List all attribute names
   * @returns {Array<string>} Attribute names
   */
  listAttributes() {
    return Array.from(this.attributes.keys());
  }

  /**
   * Subscribe to remote handle events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    // Store local callback
    if (!this.localSubscriptions) {
      this.localSubscriptions = new Map();
    }
    
    if (!this.localSubscriptions.has(event)) {
      this.localSubscriptions.set(event, new Set());
    }
    
    this.localSubscriptions.get(event).add(callback);
    
    // Tell remote handle about subscription
    this.actorChannel.sendMessage('subscribe-remote', {
      handleId: this.handleId,
      event: event,
      subscriberGuid: this.actorChannel.getLocalGuid()
    });
    
    // Return unsubscribe function
    return () => {
      this.localSubscriptions.get(event)?.delete(callback);
      this.actorChannel.sendMessage('unsubscribe-remote', {
        handleId: this.handleId,
        event: event,
        subscriberGuid: this.actorChannel.getLocalGuid()
      });
    };
  }

  /**
   * Handle incoming events from remote handle
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  handleRemoteEvent(event, data) {
    const subscribers = this.localSubscriptions?.get(event);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in remote handle event callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get remote handle GUID
   * @returns {string} Handle GUID
   */
  getGuid() {
    return this.handleId;
  }

  /**
   * Dynamic method forwarding to remote handle
   * All methods not defined above are forwarded to the remote handle
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `RemoteHandle(${this.handleType}:${this.handleId})`;
  }
}

// Create proxy for dynamic method forwarding
export function createRemoteHandleProxy(serializedData, actorChannel) {
  const remoteHandle = new RemoteHandle(serializedData, actorChannel);
  
  return new Proxy(remoteHandle, {
    get(target, prop) {
      // Return existing properties directly
      if (prop in target || typeof prop === 'symbol') {
        return target[prop];
      }
      
      // Check if this is a method on the handle type
      const type = target.type;
      if (type && type.respondsTo(prop)) {
        // Return function that forwards call to remote handle
        return (...args) => {
          return target.actorChannel.sendMessage('call-method', {
            handleId: target.handleId,
            method: prop,
            args: args
          });
        };
      }
      
      // Check if this is an attribute
      if (target.attributes.has(prop)) {
        return target.getAttribute(prop);
      }
      
      // Unknown property
      return undefined;
    },
    
    has(target, prop) {
      // Check existing properties
      if (prop in target) return true;
      
      // Check type methods
      const type = target.type;
      if (type && type.respondsTo(prop)) return true;
      
      // Check attributes
      if (target.attributes.has(prop)) return true;
      
      return false;
    }
  });
}