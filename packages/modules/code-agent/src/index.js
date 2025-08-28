/**
 * @legion/code-agent - Intelligent coding agent for vanilla JavaScript projects
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

// Export enhanced components
export { EnhancedCodeAgent } from './agent/EnhancedCodeAgent.js';
export { EnhancedQualityPhase } from './phases/EnhancedQualityPhase.js';
export { ComprehensiveTestingPhase } from './phases/ComprehensiveTestingPhase.js';
export { EnhancedFixingPhase } from './phases/EnhancedFixingPhase.js';

// Export runtime integration
export { RuntimeIntegrationManager } from './integration/RuntimeIntegrationManager.js';

// Export monitoring and optimization
export { SystemHealthMonitor } from './monitoring/SystemHealthMonitor.js';
export { PerformanceOptimizer } from './optimization/PerformanceOptimizer.js';

// Export test execution components
export { TestExecutionEngine } from './execution/TestExecutionEngine.js';
export { ParallelTestExecutor } from './execution/ParallelTestExecutor.js';
export { RealESLintExecutor } from './execution/RealESLintExecutor.js';
export { RealJestExecutor } from './execution/RealJestExecutor.js';

// Export browser testing components
export { BrowserTestGenerator } from './browser/BrowserTestGenerator.js';
export { E2ETestRunner } from './browser/E2ETestRunner.js';
export { FrontendValidationEngine } from './browser/FrontendValidationEngine.js';

// Export logging and analysis
export { TestLogManager } from './logging/TestLogManager.js';
export { LogAnalysisEngine } from './logging/LogAnalysisEngine.js';

// Export security and monitoring
export { SecurityScanner } from './security/SecurityScanner.js';
export { PerformanceMonitor } from './monitoring/PerformanceMonitor.js';

// Export validation
export { E2EValidator } from './validation/E2EValidator.js';

// Export wrapper for JSON module system
import CodeAgentWrapper from './CodeAgentWrapper.js';
export { CodeAgentWrapper };

// Export Legion Module
export { CodeAgentModule } from './CodeAgentModule.js';

// Default export - Legion Module
export { CodeAgentModule as default } from './CodeAgentModule.js';