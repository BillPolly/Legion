/**
 * KGEntityHandle - Client handle for interacting with KGDataStoreActor
 * Provides a simple API for KG operations through actor messages
 */

export class KGEntityHandle {
  constructor(options = {}) {
    const { actorSpace, dataStoreId } = options;
    
    this.actorSpace = actorSpace;
    this.dataStoreId = dataStoreId;
    this._changeListeners = new Set();
  }

  /**
   * Send a message to the data store actor and wait for response
   */
  async _sendMessage(type, payload) {
    const actor = this.actorSpace.guidToObject.get(this.dataStoreId);
    if (!actor) {
      console.warn(`Data store actor ${this.dataStoreId} not found`);
      return { success: false, error: 'Actor not found' };
    }
    
    // Create a mock client for receiving responses
    const client = {
      id: `client-${Date.now()}`,
      response: null,
      send: function(message) {
        this.response = message;
      }
    };
    
    // Send message to actor
    const result = await actor.receive({ type, payload }, client);
    
    return result || { success: false };
  }

  /**
   * Add an object to the knowledge graph
   * @param {Object} obj - Object to add
   * @param {string} id - Optional ID
   * @returns {Promise<string>} Object ID
   */
  async add(obj, id = null) {
    const result = await this._sendMessage('add', { object: obj, id });
    return result.success ? result.id : null;
  }

  /**
   * Get an object from the knowledge graph
   * @param {string} id - Object ID
   * @returns {Promise<Object|null>} Object or null
   */
  async get(id) {
    const result = await this._sendMessage('get', { id });
    return result.success ? result.object : null;
  }

  /**
   * Update an object in the knowledge graph
   * @param {Object} obj - Object to update
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Updated object
   */
  async update(obj, updates) {
    const result = await this._sendMessage('update', { object: obj, updates });
    return result.success ? result.object : null;
  }

  /**
   * Remove an object from the knowledge graph
   * @param {string|Object} objOrId - Object or ID to remove
   * @returns {Promise<void>}
   */
  async remove(objOrId) {
    const id = typeof objOrId === 'string' ? objOrId : null;
    const obj = typeof objOrId === 'object' ? objOrId : null;
    await this._sendMessage('remove', { id, object: obj });
  }

  /**
   * Find objects matching a pattern
   * @param {Object} pattern - Pattern to match
   * @returns {Promise<Array>} Matching objects
   */
  async find(pattern) {
    const result = await this._sendMessage('find', { pattern });
    return result.success ? result.results : [];
  }

  /**
   * Get all objects
   * @returns {Promise<Array>} All objects
   */
  async getAll() {
    const result = await this._sendMessage('getAll', {});
    return result.success ? result.results : [];
  }

  /**
   * Execute a DataScript query
   * @param {string} query - Query string
   * @param {...any} inputs - Query inputs
   * @returns {Promise<Array>} Query results
   */
  async query(query, ...inputs) {
    const result = await this._sendMessage('query', { query, inputs });
    return result.success ? result.results : [];
  }

  /**
   * Subscribe to changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  async onChange(callback) {
    this._changeListeners.add(callback);
    
    // We need to subscribe but the actor is expecting the client object in 'from'
    // The _sendMessage method needs to be aware of subscriptions
    
    // Store the callback for this handle
    if (!this._subscriptionCallback) {
      this._subscriptionCallback = (changes) => {
        // Notify all listeners of this handle
        for (const listener of this._changeListeners) {
          try {
            listener(changes);
          } catch (error) {
            console.error('Error in change listener:', error);
          }
        }
      };
      
      // Subscribe to the actor with a special client that can receive notifications
      const actor = this.actorSpace.guidToObject.get(this.dataStoreId);
      if (actor) {
        const client = {
          id: `client-${this.dataStoreId}-${Date.now()}`,
          send: (message) => {
            if (message.type === 'change-notification') {
              this._subscriptionCallback(message.changes);
            }
          }
        };
        
        // Store client for later use
        this._subscriptionClient = client;
        
        // Subscribe via the actor's receive method
        await actor.receive({ type: 'subscribe', payload: {} }, client);
      }
    }
    
    return () => {
      this._changeListeners.delete(callback);
      
      // If no more listeners, unsubscribe from actor
      if (this._changeListeners.size === 0 && this._subscriptionClient) {
        const actor = this.actorSpace.guidToObject.get(this.dataStoreId);
        if (actor) {
          actor.receive({ type: 'unsubscribe', payload: {} }, this._subscriptionClient);
        }
        this._subscriptionClient = null;
        this._subscriptionCallback = null;
      }
    };
  }

  /**
   * Destroy the handle
   */
  async destroy() {
    this._changeListeners.clear();
  }
}