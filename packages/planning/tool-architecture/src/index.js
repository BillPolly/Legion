/**
 * Tool Architecture Framework - Main Entry Point
 * 
 * Exports all tool architecture components
 */

// Core module components
export { ModuleDefinition } from './modules/ModuleDefinition.js';
export { ModuleInstance } from './modules/ModuleInstance.js';
export { Tool } from './modules/Tool.js';

// Module implementations
export { FileSystemModule } from './modules/FileSystemModule.js';
export { GitModule } from './modules/GitModule.js';
export { HTTPModule } from './modules/HTTPModule.js';

// Integration components
export { ToolRegistry } from './integration/ToolRegistry.js';
export { ConfigurationManager } from './integration/ConfigurationManager.js';

// Utilities
export { CLIWrapper } from './utils/CLIWrapper.js';
export { ConfigurationWrapper } from './utils/ConfigurationWrapper.js';
export { ErrorHandling } from './utils/ErrorHandling.js';
export { EventEmitter } from './utils/EventEmitter.js';
export { HandleManager } from './utils/HandleManager.js';
export { LibraryIntegration } from './utils/LibraryIntegration.js';
export { MethodWrapper } from './utils/MethodWrapper.js';
export { ToolFactory } from './utils/ToolFactory.js';
export { Validation } from './utils/Validation.js';