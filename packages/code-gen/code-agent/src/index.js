/**
 * @jsenvoy/code-agent - Intelligent coding agent for vanilla JavaScript projects
 * 
 * This package provides an AI-powered coding agent that can generate, test, and validate
 * complete JavaScript projects with automated quality assurance.
 */

// Import and re-export the modularized CodeAgent
export { CodeAgent } from './agent/index.js';

// Export generators for advanced usage
export { 
  HTMLGenerator,
  JSGenerator,
  CSSGenerator,
  TestGenerator
} from './generation/index.js';

// Export configuration managers
export {
  EslintConfigManager,
  JestConfigManager,
  StateManager
} from './config/index.js';

// Export planning system
export { UnifiedPlanner } from './planning/llm/UnifiedPlanner.js';

// Export phase classes for advanced usage
export { 
  PlanningPhase,
  GenerationPhase,
  TestingPhase,
  QualityPhase,
  FixingPhase
} from './agent/index.js';

// Default export
import { CodeAgent } from './agent/index.js';
export default CodeAgent;