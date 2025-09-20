/**
 * TaskStrategy - Base class for pluggable task execution strategies
 * 
 * Task delegates ALL behavior to its strategy:
 * - Classification: How to determine if task is simple or complex
 * - Decomposition: How to break down complex tasks
 * - Execution: How to execute simple tasks
 * - Child completion handling: What to do when a child task completes
 * - Child failure handling: What to do when a child task fails  
 * - Completion evaluation: How to determine if task is complete
 * - Presentation: How to format task results
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
   * Initialize the strategy with context
   * @param {Object} context - Initialization context
   */
  async initialize(context = {}) {
    // Subclasses can override to perform initialization
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {Task} task - The task to classify
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(task, context) {
    throw new Error('TaskStrategy.classify() must be implemented by subclass');
  }

  /**
   * Decompose a complex task into subtasks
   * @param {Task} task - The task to decompose
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Decomposition result with subtasks
   */
  async decompose(task, context) {
    throw new Error('TaskStrategy.decompose() must be implemented by subclass');
  }

  /**
   * Execute a simple task
   * @param {Task} task - The task to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeSimple(task, context) {
    throw new Error('TaskStrategy.executeSimple() must be implemented by subclass');
  }

  /**
   * Execute a complex task
   * @param {Task} task - The task to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeComplex(task, context) {
    throw new Error('TaskStrategy.executeComplex() must be implemented by subclass');
  }

  /**
   * Handle child task completion
   * Called when a child task completes successfully
   * @param {Task} task - The parent task
   * @param {Task} childTask - The completed child task
   * @param {Object} result - Child task result
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} What parent should do next
   */
  async onChildComplete(task, childTask, result, context) {
    throw new Error('TaskStrategy.onChildComplete() must be implemented by subclass');
  }

  /**
   * Handle child task failure
   * Called when a child task fails
   * @param {Task} task - The parent task
   * @param {Task} childTask - The failed child task
   * @param {Error} error - The failure error
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} What parent should do next
   */
  async onChildFailure(task, childTask, error, context) {
    throw new Error('TaskStrategy.onChildFailure() must be implemented by subclass');
  }

  /**
   * Evaluate if a task is complete
   * @param {Task} task - The task to evaluate
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Completion evaluation result
   */
  async evaluateCompletion(task, context) {
    throw new Error('TaskStrategy.evaluateCompletion() must be implemented by subclass');
  }

  /**
   * Format task result for presentation
   * @param {Task} task - The task
   * @param {Object} result - The task result
   * @param {Object} context - Execution context
   * @returns {Object} Formatted result
   */
  formatResult(task, result, context) {
    // Default implementation - subclasses can override
    return result;
  }

  /**
   * Validate task inputs before execution
   * @param {Task} task - The task to validate
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Validation result with valid boolean and errors array
   */
  async validateInputs(task, context) {
    // Default implementation - always valid
    return { valid: true, errors: [] };
  }

  /**
   * Prepare context for task execution
   * @param {Task} task - The task
   * @param {Object} context - Base execution context
   * @returns {Object} Prepared context
   */
  prepareContext(task, context) {
    // Default implementation - pass through
    return context;
  }
}