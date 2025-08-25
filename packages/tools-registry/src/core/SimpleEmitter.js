/**
 * SimpleEmitter - A simple subscription-based event system
 * All events go through a single callback per subscriber
 */

export class SimpleEmitter {
  constructor() {
    this.subscribers = new Set();
  }

  /**
   * Subscribe to events
   * @param {Function} callback - Function to call with (eventName, eventData)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventName - Name of the event
   * @param {*} eventData - Data to pass with the event
   */
  emit(eventName, eventData) {
    for (const callback of this.subscribers) {
      try {
        callback(eventName, eventData);
      } catch (error) {
        // Log but don't throw - one subscriber's error shouldn't affect others
        console.error(`Subscriber error for event ${eventName}:`, error);
      }
    }
  }

  /**
   * Remove all subscribers
   */
  clearSubscribers() {
    this.subscribers.clear();
  }

  /**
   * Get the number of subscribers
   * @returns {number} Number of subscribers
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }
}