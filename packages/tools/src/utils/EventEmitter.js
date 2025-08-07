/**
 * Simple EventEmitter for Tools and ModuleInstances
 * Supports flexible JSON event objects with no strict schema
 */

export class EventEmitter {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  on(eventName, listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    
    this._listeners.get(eventName).add(listener);
    return this;
  }

  /**
   * Subscribe to an event that fires only once
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  once(eventName, listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    if (!this._onceListeners.has(eventName)) {
      this._onceListeners.set(eventName, new Set());
    }
    
    this._onceListeners.get(eventName).add(listener);
    return this;
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function to remove
   * @returns {EventEmitter} This instance for chaining
   */
  off(eventName, listener) {
    if (this._listeners.has(eventName)) {
      this._listeners.get(eventName).delete(listener);
      
      // Clean up empty sets
      if (this._listeners.get(eventName).size === 0) {
        this._listeners.delete(eventName);
      }
    }

    if (this._onceListeners.has(eventName)) {
      this._onceListeners.get(eventName).delete(listener);
      
      // Clean up empty sets
      if (this._onceListeners.get(eventName).size === 0) {
        this._onceListeners.delete(eventName);
      }
    }

    return this;
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   * @param {string} [eventName] - Name of the event (optional)
   * @returns {EventEmitter} This instance for chaining
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this._listeners.delete(eventName);
      this._onceListeners.delete(eventName);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
    }
    
    return this;
  }

  /**
   * Emit an event with data
   * @param {string} eventName - Name of the event
   * @param {Object} eventData - Event data (flexible JSON object)
   * @returns {boolean} True if event had listeners
   */
  emit(eventName, eventData = {}) {
    let hadListeners = false;
    
    // Add standard event metadata
    const enrichedEventData = {
      ...eventData,
      eventName,
      timestamp: Date.now(),
      source: this.constructor.name
    };

    // Fire regular listeners
    if (this._listeners.has(eventName)) {
      const listeners = Array.from(this._listeners.get(eventName));
      hadListeners = listeners.length > 0;
      
      for (const listener of listeners) {
        try {
          listener(enrichedEventData);
        } catch (error) {
          // Don't let listener errors break event emission
          console.error(`Event listener error for '${eventName}':`, error);
        }
      }
    }

    // Fire once listeners and remove them
    if (this._onceListeners.has(eventName)) {
      const onceListeners = Array.from(this._onceListeners.get(eventName));
      hadListeners = hadListeners || onceListeners.length > 0;
      
      // Remove all once listeners before firing them
      this._onceListeners.delete(eventName);
      
      for (const listener of onceListeners) {
        try {
          listener(enrichedEventData);
        } catch (error) {
          console.error(`Event listener error (once) for '${eventName}':`, error);
        }
      }
    }

    return hadListeners;
  }

  /**
   * Get list of events that have listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    const names = new Set();
    
    for (const eventName of this._listeners.keys()) {
      names.add(eventName);
    }
    
    for (const eventName of this._onceListeners.keys()) {
      names.add(eventName);
    }
    
    return Array.from(names);
  }

  /**
   * Get the number of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number} Number of listeners
   */
  listenerCount(eventName) {
    const regularCount = this._listeners.has(eventName) ? this._listeners.get(eventName).size : 0;
    const onceCount = this._onceListeners.has(eventName) ? this._onceListeners.get(eventName).size : 0;
    return regularCount + onceCount;
  }

  /**
   * Get all listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {Function[]} Array of listener functions
   */
  listeners(eventName) {
    const listeners = [];
    
    if (this._listeners.has(eventName)) {
      listeners.push(...Array.from(this._listeners.get(eventName)));
    }
    
    if (this._onceListeners.has(eventName)) {
      listeners.push(...Array.from(this._onceListeners.get(eventName)));
    }
    
    return listeners;
  }

  /**
   * Create a promise that resolves when an event is emitted
   * @param {string} eventName - Name of the event to wait for
   * @param {number} [timeout] - Optional timeout in milliseconds
   * @returns {Promise<Object>} Promise that resolves with event data
   */
  waitForEvent(eventName, timeout) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
      
      // Set up timeout if specified
      if (timeout) {
        timeoutId = setTimeout(() => {
          this.off(eventName, listener);
          reject(new Error(`Event '${eventName}' timeout after ${timeout}ms`));
        }, timeout);
      }
      
      // Set up listener
      const listener = (eventData) => {
        cleanup();
        resolve(eventData);
      };
      
      this.once(eventName, listener);
    });
  }
}