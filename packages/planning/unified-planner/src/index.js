/**
 * @legion/unified-planner - Unified planning system for Legion framework
 * 
 * Combines the best features from llm-planner and recursive-planner into a single,
 * modular planning system that generates Behavior Tree structures for execution.
 * 
 * Key Features:
 * - Multiple planning strategies (LLM, Template, Rule-based)
 * - Direct BT structure generation (no conversion needed)
 * - Intelligent defaults and robust error handling
 * - Clean separation from execution logic
 * - Template-based prompt engineering
 * - Comprehensive validation integration
 */

// Core engine and request types
export { 
  PlannerEngine, 
  PlanningRequest, 
  PlanningResult 
} from './core/PlannerEngine.js';

// Planning strategies
export { PlanningStrategy } from './strategies/PlanningStrategy.js';
export { LLMStrategy } from './strategies/LLMStrategy.js';
export { TemplateStrategy } from './strategies/TemplateStrategy.js';
export { RuleStrategy, PlanningRule } from './strategies/RuleStrategy.js';

// Template system
export { PromptTemplateLoader } from './templates/PromptTemplateLoader.js';

// Factory functions for easy setup
export * from './factories.js';

// Default export - main planner engine
import { PlannerEngine } from './core/PlannerEngine.js';
export default PlannerEngine;