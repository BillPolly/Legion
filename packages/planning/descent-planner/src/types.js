/**
 * Type definitions for descent-planner
 */

/**
 * @typedef {Object} TaskNode
 * @property {string} id - Unique task identifier
 * @property {string} description - Task description
 * @property {'SIMPLE'|'COMPLEX'} complexity - Task complexity
 * @property {number} level - Hierarchy level
 * @property {TaskNode[]} children - Subtasks (for complex tasks)
 * @property {Object} artifacts - Input/output artifacts
 */

/**
 * @typedef {Object} DecompositionResult
 * @property {boolean} success - Whether decomposition succeeded
 * @property {TaskNode[]} tasks - Decomposed tasks
 * @property {Object} metadata - Additional decomposition metadata
 */

/**
 * @typedef {Object} PlanResult
 * @property {boolean} success - Whether planning succeeded
 * @property {Object} data - Plan data
 * @property {TaskNode} data.hierarchy - Task hierarchy
 * @property {Object} data.behaviorTrees - BT for each simple task
 * @property {Object} data.artifacts - Expected artifacts
 * @property {Array} data.executionPlan - Ordered execution sequence
 * @property {string} error - Error message if failed
 */

export const TaskNode = {};
export const DecompositionResult = {};
export const PlanResult = {};