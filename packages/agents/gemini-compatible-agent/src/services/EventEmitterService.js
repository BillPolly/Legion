import { EventEmitter } from 'events';

/**
 * Central event management service for the Gemini Compatible Agent
 */
class EventEmitterService extends EventEmitter {
  constructor() {
    super();
    this.eventTypes = new Set();
  }

  /**
   * Registers a new event type
   * @param {string} eventType - Type of event to register
   */
  registerEventType(eventType) {
    this.eventTypes.add(eventType);
  }

  /**
   * Emits an event with validation
   * @param {string} eventType - Type of event to emit
   * @param {*} data - Event data
   */
  safeEmit(eventType, data) {
    if (!this.eventTypes.has(eventType)) {
      throw new Error(`Unregistered event type: ${eventType}`);
    }
    this.emit(eventType, data);
  }

  /**
   * Removes all listeners for a specific event type
   * @param {string} eventType - Event type to clean up
   */
  cleanupEventType(eventType) {
    this.removeAllListeners(eventType);
    this.eventTypes.delete(eventType);
  }
}

export default EventEmitterService;
