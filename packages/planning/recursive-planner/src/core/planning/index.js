/**
 * Planning module exports - Now redirects to unified planning system
 */

export { Planner } from './Planner.js';

// Re-export from unified planning packages
export { 
  PlannerEngine as PlanValidator,  // Backward compatibility alias
  PlanningResult as ValidationResult,  // Backward compatibility alias
  BTValidator 
} from '@legion/unified-planner';

// Also export the actual new components
export {
  PlannerEngine,
  PlanningRequest,
  LLMStrategy,
  TemplateStrategy,
  RuleStrategy
} from '@legion/unified-planner';