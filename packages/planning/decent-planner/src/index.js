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

// Core components still in use
export { ContextHints } from './core/ContextHints.js';
export { ToolDiscoveryAdapter } from './core/ToolDiscoveryAdapter.js';
export { PlanSynthesizer } from './core/PlanSynthesizer.js';
export { ValidatedSubtree } from './core/ValidatedSubtree.js';

// Export types
export { DecompositionResult, PlanResult } from './types.js';