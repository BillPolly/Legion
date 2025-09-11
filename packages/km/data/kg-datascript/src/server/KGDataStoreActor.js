/**
 * KGDataStoreActor - Server-side Actor wrapping KG engine
 * Provides distributed access to the knowledge graph
 */

import { Actor } from '@legion/actors';
import { KGEngine } from '../KGEngine.js';

export class KGDataStoreActor extends Actor {
  constructor(options = {}) {
    super();
    
    // Extract options
    const { id, schema, ...otherOptions } = options;
    
    this.id = id || `kg-store-${Date.now()}`;
    this.options = {
      enableChangeNotifications: true,
      ...otherOptions
    };
    
    // Create engine with optional schema
    this.engine = new KGEngine(schema);
    this.subscriptions = new Map(); // clientId -> callback
    
    // Listen for engine changes
    if (this.options.enableChangeNotifications) {
      this.engine.onChange((changes) => {
        this._propagateChanges(changes);
      });
    }
  }

  /**
   * Receive and process messages
   */
  async receive(message, from) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'add':
          return this._handleAdd(payload);
          
        case 'get':
          return this._handleGet(payload);
          
        case 'update':
          return this._handleUpdate(payload);
          
        case 'remove':
          return this._handleRemove(payload);
          
        case 'query':
          return this._handleQuery(payload);
          
        case 'find':
          return this._handleFind(payload);
          
        case 'getAll':
          return this._handleGetAll();
          
        case 'subscribe':
          return this._handleSubscribe(payload, from);
          
        case 'unsubscribe':
          return this._handleUnsubscribe(from);
          
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle add operation
   */
  _handleAdd(payload) {
    const { object, id } = payload;
    const objectId = this.engine.add(object, id);
    
    return {
      success: true,
      id: objectId,
      object
    };
  }

  /**
   * Handle get operation
   */
  _handleGet(payload) {
    const { id } = payload;
    const object = this.engine.get(id);
    
    return {
      success: true,
      object
    };
  }

  /**
   * Handle update operation
   */
  _handleUpdate(payload) {
    const { object, updates } = payload;
    const updated = this.engine.update(object, updates);
    
    return {
      success: true,
      object: updated
    };
  }

  /**
   * Handle remove operation
   */
  _handleRemove(payload) {
    const { id } = payload;
    this.engine.remove(id);
    
    return {
      success: true,
      id
    };
  }

  /**
   * Handle query operation
   */
  _handleQuery(payload) {
    const { query, ...params } = payload;
    const results = this.engine.query(query, ...Object.values(params));
    
    return {
      success: true,
      results
    };
  }

  /**
   * Handle find operation
   */
  _handleFind(payload) {
    const { pattern } = payload;
    const results = this.engine.find(pattern);
    
    return {
      success: true,
      results
    };
  }

  /**
   * Handle getAll operation
   */
  _handleGetAll() {
    const results = this.engine.getAll();
    
    return {
      success: true,
      results
    };
  }

  /**
   * Handle subscribe operation
   */
  _handleSubscribe(payload, from) {
    const clientId = from?.id || from;
    
    if (!this.subscriptions.has(clientId)) {
      // Create subscription callback
      const callback = (changes) => {
        // Send changes to client
        if (from?.send) {
          from.send({
            type: 'change-notification',
            changes
          });
        }
      };
      
      this.subscriptions.set(clientId, callback);
    }
    
    return {
      success: true,
      subscribed: true
    };
  }

  /**
   * Handle unsubscribe operation
   */
  _handleUnsubscribe(from) {
    const clientId = from?.id || from;
    
    if (this.subscriptions.has(clientId)) {
      this.subscriptions.delete(clientId);
    }
    
    return {
      success: true,
      unsubscribed: true
    };
  }

  /**
   * Propagate changes to subscribed clients
   */
  _propagateChanges(changes) {
    for (const callback of this.subscriptions.values()) {
      try {
        callback(changes);
      } catch (error) {
        console.error('Error propagating changes:', error);
      }
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    this.subscriptions.clear();
    if (this.engine) {
      this.engine.destroy();
    }
  }

  /**
   * Get the underlying engine (for testing)
   */
  getEngine() {
    return this.engine;
  }
}