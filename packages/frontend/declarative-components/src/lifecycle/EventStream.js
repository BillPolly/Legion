/**
 * EventStream - Base class for component event management
 * 
 * Provides basic event emission, subscription, and lifecycle management.
 * Extended by HierarchicalEventStream for parent-child event communication.
 */

export class EventStream {
  constructor(options = {}) {
    this.eventHandlers = new Map(); // eventType -> Set of handlers
    this.isDestroyed = false;
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventType - Type of event to emit
   * @param {any} data - Event data to pass to handlers
   */
  emit(eventType, data) {
    if (this.isDestroyed) {
      console.warn(`Attempted to emit ${eventType} on destroyed EventStream`);
      return;
    }

    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Subscribe to an event type
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Function to call when event is emitted
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    const handlers = this.eventHandlers.get(eventType);
    handlers.add(handler);

    // Return subscription object
    return {
      unsubscribe: () => {
        if (handlers) {
          handlers.delete(handler);
          // Clean up empty handler sets
          if (handlers.size === 0) {
            this.eventHandlers.delete(eventType);
          }
        }
      }
    };
  }

  /**
   * Unsubscribe all handlers for an event type
   * @param {string} eventType - Event type to clear
   */
  unsubscribeAll(eventType) {
    this.eventHandlers.delete(eventType);
  }

  /**
   * Get list of event types that have subscribers
   * @returns {Array<string>} Array of event types
   */
  getSubscribedEvents() {
    return Array.from(this.eventHandlers.keys());
  }

  /**
   * Get number of handlers for an event type
   * @param {string} eventType - Event type to check
   * @returns {number} Number of handlers
   */
  getHandlerCount(eventType) {
    const handlers = this.eventHandlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /**
   * Check if there are any subscribers for an event type
   * @param {string} eventType - Event type to check
   * @returns {boolean} True if there are subscribers
   */
  hasSubscribers(eventType) {
    return this.getHandlerCount(eventType) > 0;
  }

  /**
   * Clean up all event handlers and mark as destroyed
   */
  cleanup() {
    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  /**
   * Check if the event stream has been destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this.isDestroyed;
  }
}