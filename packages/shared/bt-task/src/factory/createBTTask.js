/**
 * createBTTask - Factory function for creating behavior tree tasks
 * 
 * Creates tasks with BT strategies as prototypes, maintaining full
 * compatibility with the standard task system while adding BT-specific
 * configuration.
 */

import { createTask } from '@legion/tasks';

/**
 * Generate a unique ID for a BT node
 * @returns {string} Unique node ID
 */
function generateNodeId() {
  return `bt-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a behavior tree task
 * 
 * @param {string} description - Task/node description
 * @param {Object} parent - Parent task (null for root)
 * @param {Object} strategyPrototype - BT strategy prototype (e.g., SequenceStrategy, ActionStrategy)
 * @param {Object} config - BT node configuration
 * @returns {Object} The created BT task
 */
export function createBTTask(description, parent = null, strategyPrototype, config = {}) {
  // Generate nodeId if not provided
  const nodeId = config.id || config.nodeId || generateNodeId();
  
  // Create base task using standard factory
  const btTask = createTask(description, parent, strategyPrototype, {
    ...config,
    nodeType: config.type || config.nodeType,
    nodeId: nodeId
  });
  
  // Attach full BT configuration
  btTask.config = {
    ...config,
    nodeType: config.type || config.nodeType,
    nodeId: nodeId
  };
  
  return btTask;
}

export default createBTTask;