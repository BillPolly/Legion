/**
 * Decent-Planner: Hierarchical Task Decomposition and Planning
 * 
 * Main entry point for the decent-planner package
 */

// Main planner that orchestrates both phases
export { DecentPlanner } from './DecentPlanner.js';

// Informal planning components
export { 
  InformalPlanner,
  ComplexityClassifier,
  TaskDecomposer,
  ToolFeasibilityChecker,
  DecompositionValidator,
  TaskNode,
  TaskHierarchy
} from './core/informal/index.js';

// Legacy exports (to maintain compatibility)
export { DecentPlanner as DecentPlanner_Legacy } from './core/DecentPlanner.js';
export { TaskDecomposer as TaskDecomposer_Legacy } from './core/TaskDecomposer.js';
export { ContextHints } from './core/ContextHints.js';
export { ToolDiscoveryAdapter } from './core/ToolDiscoveryAdapter.js';
export { PlanSynthesizer } from './core/PlanSynthesizer.js';
export { ValidatedSubtree } from './core/ValidatedSubtree.js';

// Export types
export { TaskNode as TaskNode_Legacy, DecompositionResult, PlanResult } from './types.js';