/**
 * Project Management Package
 *
 * Exports all project management operations for use by servers and applications.
 * No transport layer - pure business logic only.
 */

// Task operations
export { getNextTask } from './get-next-task.js';
export { reportProgress } from './progress-tracking.js';
export { createTask } from './task-operations.js';

// Bug operations
export { reportBug } from './bug-operations.js';

// Plan operations
export { createPlan, updatePlan, getPlan, listPlans, deletePlan } from './plan-operations.js';

// Project status
export { getProjectStatus } from './project-status.js';

// Query operations
export { queryGraph } from './query-graph.js';

// Agent operations
export { createAgent, findAgentByName, updateAgentStatus, findAgentsByStatus } from './agent-operations.js';

// Database
export { getNeo4j } from './neo4j.js';
export { initializeSchema } from './schema.js';
