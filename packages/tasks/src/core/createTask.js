/**
 * createTask - Factory function for creating tasks in the pure prototypal system
 * 
 * Creates a task object with the given strategy as its prototype.
 * No classes, just Object.create() and property initialization.
 */

/**
 * Create a new task with the given strategy as prototype
 * @param {string} description - Task description
 * @param {Object} parent - Parent task (or null for root)
 * @param {Object} strategyPrototype - Strategy prototype object (must have onMessage method)
 * @param {Object} context - Execution context
 * @returns {Object} The created task
 */
export function createTask(description, parent = null, strategyPrototype, context = {}) {
  // Validate strategy has required method
  if (!strategyPrototype || typeof strategyPrototype.onMessage !== 'function') {
    throw new Error('Strategy prototype must have an onMessage method');
  }
  
  // Create task with strategy as prototype
  const task = Object.create(strategyPrototype);
  
  // Initialize task state using the inherited initializeTask method
  task.initializeTask(description, parent, context);
  
  return task;
}

export default createTask;