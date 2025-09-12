/**
 * Handle - Universal abstract base class for all proxy types
 * 
 * Inherits from Actor to provide remote capability for frontend/backend sharing.
 * Implements the synchronous dispatcher pattern for all proxy operations.
 * 
 * Provides common functionality for all resource proxy objects including:
 * - Resource manager reference management
 * - Synchronous subscription tracking and cleanup
 * - Destruction lifecycle management
 * - Actor system integration for remote capability
 * - Universal introspection via prototype manufacturing
 * 
 * Subclasses must implement:
 * - value() - Get the current value/data
 * - query(querySpec) - Execute queries with this handle as context
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises in Handle infrastructure!
 */

import { Actor } from '@legion/actors';
import { validateResourceManagerInterface } from './ResourceManager.js';

export class Handle extends Actor {
  constructor(resourceManager) {
    super();
    
    // Validate resource manager using standard validation function
    validateResourceManagerInterface(resourceManager, 'ResourceManager');
    
    // Store reference to resource manager (conceptual placeholder delegates to this)
    this.resourceManager = resourceManager;
    
    // Track subscriptions for cleanup (synchronous tracking)
    this._subscriptions = new Set();
    
    // Track destruction state
    this._destroyed = false;
    
    // Initialize prototype factory for introspection if schema available
    this._prototypeFactory = null;
    try {
      const schema = this.resourceManager.getSchema();
      if (schema) {
        // Will be set by subclasses that need prototype manufacturing
        this._enablePrototypeFactory(schema);
      }
    } catch (error) {
      // Schema not available or resource manager doesn't support it - continue without prototypes
    }
  }
  
  /**
   * Get current value - must be implemented by subclasses
   * CRITICAL: Must be synchronous - no await!
   */
  value() {
    throw new Error('value() must be implemented by subclass');
  }
  
  /**
   * Execute query with this handle as context - must be implemented by subclasses  
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    throw new Error('query() must be implemented by subclass');
  }
  
  /**
   * Actor system message handling
   * Routes Actor messages to appropriate handle methods
   */
  receive(message) {
    this._validateNotDestroyed();
    
    if (typeof message === 'object' && message.type) {
      switch (message.type) {
        case 'query':
          return this.query(message.querySpec);
        case 'value':
          return this.value();
        case 'subscribe':
          return this.subscribe(message.querySpec, message.callback);
        case 'destroy':
          return this.destroy();
        case 'introspect':
          return this.getIntrospectionInfo();
        default:
          return super.receive(message);
      }
    }
    
    return super.receive(message);
  }
  
  /**
   * Subscribe to changes with automatic subscription tracking
   * CRITICAL: Synchronous subscription setup - callback notifications appear async externally
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription through resource manager (synchronous dispatch)
    const resourceSubscription = this.resourceManager.subscribe(querySpec, callback);
    
    // Create tracking wrapper for cleanup (synchronous wrapper creation)
    const trackingWrapper = {
      id: resourceSubscription.id || Date.now() + Math.random(),
      unsubscribe: () => {
        // Synchronous cleanup - no timing issues possible
        this._subscriptions.delete(trackingWrapper);
        resourceSubscription.unsubscribe();
      }
    };
    
    // Track subscription for cleanup (synchronous tracking)
    this._subscriptions.add(trackingWrapper);
    
    return trackingWrapper;
  }
  
  /**
   * Get introspection information about this handle
   * Uses prototype factory if available for universal knowledge layer
   */
  getIntrospectionInfo() {
    this._validateNotDestroyed();
    
    const info = {
      handleType: this.constructor.name,
      isDestroyed: this._destroyed,
      subscriptionCount: this._subscriptions.size,
      hasPrototypeFactory: !!this._prototypeFactory
    };
    
    // Add prototype-based introspection if available
    if (this._prototypeFactory && this.entityId !== undefined) {
      try {
        // Try to get entity type and introspection info
        const entityData = this.resourceManager.query({
          find: ['?attr', '?value'],
          where: [[this.entityId, '?attr', '?value']]
        });
        
        if (entityData.length > 0) {
          const entity = {};
          entityData.forEach(([attr, value]) => {
            entity[attr] = value;
          });
          
          const detectedType = this._prototypeFactory.detectEntityType(entity);
          if (detectedType) {
            const prototype = this._prototypeFactory.getEntityPrototype(detectedType);
            const instance = new prototype(this.resourceManager, this.entityId);
            
            info.entityType = detectedType;
            info.availableAttributes = instance.getAvailableAttributes ? instance.getAvailableAttributes() : [];
            info.relationships = instance.getRelationships ? instance.getRelationships() : [];
            info.capabilities = instance.getCapabilities ? instance.getCapabilities() : [];
          }
        }
      } catch (error) {
        // Introspection failed - continue without it
        info.introspectionError = error.message;
      }
    }
    
    return info;
  }
  
  /**
   * Clean up all resources and subscriptions
   * CRITICAL: Synchronous cleanup - no race conditions
   */
  destroy() {
    if (this._destroyed) {
      return; // Safe to call multiple times
    }
    
    // Unsubscribe all subscriptions (synchronous cleanup)
    for (const subscription of this._subscriptions) {
      try {
        subscription.unsubscribe();
      } catch (error) {
        // Continue cleanup even if individual unsubscribe fails
        console.warn('Failed to unsubscribe during Handle cleanup:', error);
      }
    }
    
    // Clear subscription tracking (synchronous)
    this._subscriptions.clear();
    
    // Clean up prototype factory
    if (this._prototypeFactory && typeof this._prototypeFactory.clearCache === 'function') {
      this._prototypeFactory.clearCache();
    }
    
    // Mark as destroyed
    this._destroyed = true;
  }
  
  /**
   * Check if handle has been destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }
  
  /**
   * Enable prototype factory for introspection
   * Called by subclasses that need prototype manufacturing capabilities
   * @protected
   */
  _enablePrototypeFactory(schema, schemaFormat = 'auto') {
    if (!this._prototypeFactory) {
      // Import PrototypeFactory dynamically to avoid circular dependencies
      import('./PrototypeFactory.js').then(({ PrototypeFactory }) => {
        this._prototypeFactory = new PrototypeFactory(this.constructor);
        this._prototypeFactory.analyzeSchema(schema, schemaFormat);
      }).catch(error => {
        console.warn('Failed to load PrototypeFactory:', error);
      });
    }
  }
  
  /**
   * Internal validation helper
   * @protected
   */
  _validateNotDestroyed() {
    if (this._destroyed) {
      throw new Error('Handle has been destroyed');
    }
  }
  
  /**
   * Validate query specification
   * Basic validation - subclasses can extend for resource-specific validation
   * @protected
   */
  _validateQuerySpec(querySpec, context = 'Query specification') {
    if (!querySpec) {
      throw new Error(`${context} is required`);
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    // Basic structure validation - resource-specific validation in subclasses
    if (!querySpec.find && !querySpec.where) {
      throw new Error(`${context} must have find or where clause`);
    }
  }
  
  /**
   * Validate callback function
   * @protected
   */
  _validateCallback(callback, context = 'Callback') {
    if (!callback || typeof callback !== 'function') {
      throw new Error(`${context} function is required`);
    }
  }
}