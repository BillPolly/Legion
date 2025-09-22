/**
 * TaskStrategy - Minimal base class for pluggable task execution strategies
 * 
 * Provides just 3 core methods for task execution and parent-child communication.
 * All implementation details (classification, decomposition, etc.) are internal to each strategy.
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
   * Handle message from any source task
   * @param {Task} sourceTask - The task sending the message
   * @param {Object} message - Message object with type and payload
   * @returns {Promise<Object>} Response to sender
   */
  async onMessage(sourceTask, message) {
    throw new Error('TaskStrategy.onMessage() must be implemented by subclass');
  }
}