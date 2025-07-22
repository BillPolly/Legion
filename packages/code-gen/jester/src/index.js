/**
 * Jest Agent Wrapper (JAW) - Main Entry Point
 * 
 * A comprehensive Jest wrapper that transforms console output into structured,
 * queryable data for AI coding agents to excel at Test-Driven Development.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

// Core Components
export { JestAgentWrapper } from './core/JestAgentWrapper.js';
export { EventCollector } from './core/EventCollector.js';

// Storage Components
export { StorageEngine } from './storage/StorageEngine.js';
export { QueryEngine } from './storage/QueryEngine.js';

// Reporter
export { JestAgentReporter } from './reporter/JestAgentReporter.js';

// CLI
export { JestAgentCLI } from './cli/JestAgentCLI.js';

// Agent Utilities
export { AgentTDDHelper } from './agents/AgentTDDHelper.js';

// Utilities
export * from './utils/index.js';

// Types and Constants
export * from './types/index.js';

// Default export is the main wrapper class
export { JestAgentWrapper as default } from './core/JestAgentWrapper.js';
