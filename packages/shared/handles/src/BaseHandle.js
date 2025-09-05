/**
 * BaseHandle - Base class for all handles with generic actor capabilities
 * 
 * Provides generic method dispatch, caching, subscriptions, and introspection
 * while extending Actor for automatic remote transparency.
 */

import { Actor } from '@legion/actors';
import { HandleCache } from './HandleCache.js';
import { HandleSubscriptions } from './HandleSubscriptions.js';

export class BaseHandle extends Actor {
  constructor(handleType, data = {}) {
    super();
    
    this.handleType = handleType;
    this.data = data;
    this.attributes = new Map();
    
    // Initialize with proper cache and subscription systems
    this.cache = new HandleCache();
    this.subscriptions = new HandleSubscriptions(this);
  }

  /**
   * Get TypeHandle for introspection (Smalltalk-style)
   * @returns {TypeHandle|null} Type metadata handle or null if not registered
   */
  get type() {
    if (typeof global.TypeHandleRegistry === 'undefined') {
      throw new Error('TypeHandleRegistry not available - ensure it is imported');
    }
    
    return global.TypeHandleRegistry.getTypeHandle(this.handleType);
  }

  /**
   * Generic method call infrastructure with caching and side effects
   * @param {string} methodName - Method to call
   * @param {Array} args - Method arguments  
   * @returns {Promise<any>} Method result
   */
  async callMethod(methodName, args) {
    const internalMethod = `_${methodName}`;
    
    if (typeof this[internalMethod] !== 'function') {
      throw new Error(`Method ${methodName} not supported by ${this.handleType}`);
    }

    // Get method metadata if type is available
    const typeHandle = this.type;
    const methodMeta = typeHandle?.getMethodSignature(methodName);
    
    // Check cache if method is cacheable
    if (methodMeta?.cacheable) {
      const cacheKey = `method:${methodName}:${JSON.stringify(args)}`;
      const cached = this.getCachedValue(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Execute the actual implementation method
    const result = await this[internalMethod](...args);
    
    // Cache result if method is cacheable
    if (methodMeta?.cacheable) {
      const cacheKey = `method:${methodName}:${JSON.stringify(args)}`;
      const ttl = methodMeta.ttl || 0;
      this.setCachedValue(cacheKey, result, ttl);
    }

    // Emit side effects if specified
    if (methodMeta?.sideEffects) {
      methodMeta.sideEffects.forEach(event => {
        this.emit(event, result);
      });
    }

    return result;
  }

  /**
   * Generic caching - get cached value
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  getCachedValue(key) {
    return this.cache.get(key);
  }

  /**
   * Generic caching - set cached value with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (0 = no expiration)
   * @returns {any} The cached value
   */
  setCachedValue(key, value, ttl = 0) {
    this.cache.set(key, value, ttl);
    return value;
  }

  /**
   * Generic cache invalidation by pattern
   * @param {string} pattern - Pattern to match cache keys
   */
  invalidateCache(pattern) {
    this.cache.invalidate(pattern);
  }

  /**
   * Generic subscription system - subscribe to events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    return this.subscriptions.subscribe(event, callback);
  }

  /**
   * Unsubscribe from event
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(event, callback) {
    this.subscriptions.unsubscribe(event, callback);
  }

  /**
   * Generic event emission with local and remote forwarding
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    this.subscriptions.emit(event, data);
  }

  /**
   * Generic attribute system - get attribute
   * @param {string} name - Attribute name
   * @returns {any} Attribute value
   */
  getAttribute(name) {
    return this.attributes.get(name);
  }

  /**
   * Generic attribute system - set attribute  
   * @param {string} name - Attribute name
   * @param {any} value - Attribute value
   */
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  /**
   * List all attribute names
   * @returns {Array<string>} Attribute names
   */
  listAttributes() {
    return Array.from(this.attributes.keys());
  }

  /**
   * Get handle GUID (for actor system integration)
   * @returns {string} Handle GUID
   */
  getGuid() {
    // For now, generate a simple GUID
    // TODO: Integrate with actor system GUID when available
    if (!this._guid) {
      this._guid = `handle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._guid;
  }

  /**
   * Send message to actor (for remote subscription forwarding)
   * @param {string} actorGuid - Target actor GUID
   * @param {string} messageType - Message type
   * @param {Object} data - Message data
   */
  sendToActor(actorGuid, messageType, data) {
    // TODO: Integrate with actor system messaging
    // For now, just log the message
    console.log(`[BaseHandle] Would send to actor ${actorGuid}: ${messageType}`, data);
  }

  /**
   * Actor message handler for remote method calls
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   */
  async receive(messageType, data) {
    switch (messageType) {
      case 'call-method':
        return await this.callMethod(data.method, data.args);
        
      case 'get-attribute':
        return this.getAttribute(data.attribute);
        
      case 'set-attribute':
        this.setAttribute(data.attribute, data.value);
        return true;
        
      case 'subscribe-event':
        // TODO: Implement remote subscription
        return true;
        
      default:
        // Delegate to parent Actor class
        return await super.receive(messageType, data);
    }
  }

  /**
   * Serialize handle for ActorSerializer delegation
   * Returns handle metadata instead of full object for remote transmission
   * @returns {Object} Serialization data for ActorSerializer
   */
  serialize() {
    return {
      __type: 'RemoteHandle',
      handleId: this.getGuid(),
      handleType: this.handleType,
      attributes: Object.fromEntries(this.attributes),
      data: this.data
    };
  }

  /**
   * Clean up resources when handle is disposed
   */
  dispose() {
    this.cache.clear();
    this.subscriptions.clear();
    this.attributes.clear();
  }
}