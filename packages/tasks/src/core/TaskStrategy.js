/**
 * TaskStrategy - Minimal base class for pluggable task execution strategies
 * 
 * Provides just 3 core methods for task execution and parent-child communication.
 * All implementation details (classification, decomposition, etc.) are internal to each strategy.
 * 
 * Message Pattern: Uses fire-and-forget messaging via send() method.
 * The private #onMessage() is synchronous and handles messages without return values.
 */

export default class TaskStrategy {
  /**
   * Get the strategy name
   * @returns {string} Strategy name
   */
  getName() {
    throw new Error('TaskStrategy.getName() must be implemented by subclass');
  }

  /**
   * Initialize the strategy
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    // Subclasses can override to perform initialization
  }

  /**
   * Send a message to this strategy (fire-and-forget)
   * @param {Task} sourceTask - The task sending the message
   * @param {Object} message - Message object with type and payload
   */
  send(sourceTask, message) {
    // Queue the message handling on the next tick to ensure fire-and-forget behavior
    setImmediate(() => {
      try {
        this.#onMessage(sourceTask, message);
      } catch (error) {
        console.error(`TaskStrategy ${this.getName?.() || 'unknown'} message handling error:`, error);
        // In a proper message system, this error would be logged but not propagated
        // since it's fire-and-forget
      }
    });
  }

  /**
   * Private synchronous message handler
   * @param {Task} sourceTask - The task sending the message
   * @param {Object} message - Message object with type and payload
   * @private
   */
  #onMessage(sourceTask, message) {
    throw new Error('TaskStrategy.#onMessage() must be implemented by subclass');
  }

  /**
   * @deprecated Use send() instead. This method violates the message pattern.
   * Handle message from any source task
   * @param {Task} sourceTask - The task sending the message
   * @param {Object} message - Message object with type and payload
   * @returns {Promise<Object>} Response to sender
   */
  async onMessage(sourceTask, message) {
    console.warn('DEPRECATED: TaskStrategy.onMessage() called. Use send() instead for proper message pattern.');
    // For backward compatibility during transition, delegate to the private method
    // but wrap in a promise to maintain the async interface
    return new Promise((resolve) => {
      try {
        this.#onMessage(sourceTask, message);
        resolve({ acknowledged: true });
      } catch (error) {
        console.error('Error in deprecated onMessage:', error);
        resolve({ acknowledged: false, error: error.message });
      }
    });
  }
}