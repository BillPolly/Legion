/**
 * EventStream - Represents a stream of DOM events
 * 
 * Provides subscription-based event handling for DOM elements.
 * Events are treated as first-class streams that can be subscribed to.
 */

export class EventStream {
  constructor(element, eventType) {
    if (!element) {
      throw new Error('Element is required for EventStream');
    }
    
    if (!eventType) {
      throw new Error('Event type is required for EventStream');
    }
    
    this.element = element;
    this.eventType = eventType;
    this.subscriptions = new Set();
    this._handler = null;
    this._destroyed = false;
  }
  
  /**
   * Subscribe to this event stream
   * @param {Function} callback - Function to call when event occurs
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (this._destroyed) {
      throw new Error('EventStream has been destroyed');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Add to subscriptions
    this.subscriptions.add(callback);
    
    // Set up event handler if not already set
    if (!this._handler) {
      this._handler = (event) => {
        // Call all subscriptions
        for (const sub of this.subscriptions) {
          try {
            sub(event);
          } catch (error) {
            console.error('Error in event stream subscription:', error);
          }
        }
      };
      
      this.element.addEventListener(this.eventType, this._handler);
    }
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(callback);
      
      // Remove event handler if no more subscriptions
      if (this.subscriptions.size === 0 && this._handler) {
        this.element.removeEventListener(this.eventType, this._handler);
        this._handler = null;
      }
    };
  }
  
  /**
   * Transform this stream with a mapping function
   * @param {Function} mapFn - Function to transform events
   * @returns {EventStream} New transformed stream
   */
  map(mapFn) {
    if (this._destroyed) {
      throw new Error('EventStream has been destroyed');
    }
    
    // Create a virtual stream that transforms events
    return {
      subscribe: (callback) => {
        return this.subscribe(event => {
          const transformed = mapFn(event);
          callback(transformed);
        });
      },
      map: (nextMapFn) => {
        return this.map(event => nextMapFn(mapFn(event)));
      },
      filter: (filterFn) => {
        return this.filter(event => {
          const transformed = mapFn(event);
          return filterFn(transformed);
        });
      }
    };
  }
  
  /**
   * Filter this stream based on a predicate
   * @param {Function} filterFn - Predicate function
   * @returns {EventStream} New filtered stream
   */
  filter(filterFn) {
    if (this._destroyed) {
      throw new Error('EventStream has been destroyed');
    }
    
    // Create a virtual stream that filters events
    return {
      subscribe: (callback) => {
        return this.subscribe(event => {
          if (filterFn(event)) {
            callback(event);
          }
        });
      },
      map: (mapFn) => {
        return this.filter(filterFn).map(mapFn);
      },
      filter: (nextFilterFn) => {
        return this.filter(event => filterFn(event) && nextFilterFn(event));
      }
    };
  }
  
  /**
   * Clean up and destroy this stream
   */
  destroy() {
    if (this._destroyed) {
      return;
    }
    
    // Remove event handler
    if (this._handler) {
      this.element.removeEventListener(this.eventType, this._handler);
      this._handler = null;
    }
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    this._destroyed = true;
  }
}