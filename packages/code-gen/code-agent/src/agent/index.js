/**
 * @jsenvoy/code-agent - Intelligent coding agent for vanilla JavaScript projects
 * 
 * This package provides an AI-powered coding agent that can generate, test, and validate
 * complete JavaScript projects with automated quality assurance.
 */

// Export the main CodeAgent class
export { CodeAgent } from './CodeAgent.js';

// Export phase classes for advanced usage
export { PlanningPhase } from './phases/PlanningPhase.js';
export { GenerationPhase } from './phases/GenerationPhase.js';
export { TestingPhase } from './phases/TestingPhase.js';
export { QualityPhase } from './phases/QualityPhase.js';
export { FixingPhase } from './phases/FixingPhase.js';

// Export utilities
export { FileWriter } from './utils/FileWriter.js';
export { CodeLinter } from './utils/CodeLinter.js';

// Default export
import { CodeAgent } from './CodeAgent.js';
export default CodeAgent;