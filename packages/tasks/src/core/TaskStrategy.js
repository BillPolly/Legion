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
   * Execute a task
   * The strategy decides internally how to handle the task (classify, decompose, execute, etc.)
   * @param {Task} task - The task to execute
   * @returns {Promise<Object>} Execution result
   */
  async execute(task) {
    throw new Error('TaskStrategy.execute() must be implemented by subclass');
  }

  /**
   * Handle message from a child task
   * @param {Task} childTask - The child task sending the message
   * @param {Object} message - Message object with type and payload
   * @returns {Promise<Object>} Response to child
   */
  async onChildMessage(childTask, message) {
    throw new Error('TaskStrategy.onChildMessage() must be implemented by subclass');
  }

  /**
   * Handle message from parent task
   * @param {Task} parentTask - The parent task sending the message
   * @param {Object} message - Message object with type and payload
   * @returns {Promise<Object>} Response to parent
   */
  async onParentMessage(parentTask, message) {
    // Default implementation - ignore parent messages
    // Subclasses can override to handle parent directives
    return { acknowledged: true };
  }
}