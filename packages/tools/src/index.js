/**
 * Tool Architecture Framework - Main Entry Point
 * 
 * Complete tools package with both tool modules and core infrastructure
 */

// Core module components
export { ModuleDefinition } from './modules/ModuleDefinition.js';
export { ModuleInstance } from './modules/ModuleInstance.js';
export { Tool } from './modules/Tool.js';

// Resource management  
export { ResourceManager } from './ResourceManager.js';
export { default as ResourceManagerDefault } from './ResourceManager.js';

// Module loading system
export { ModuleLoader } from './ModuleLoader.js';
export { ModuleFactory } from './ModuleFactory.js';

// Basic compatibility exports for tools-collection 
export { ModuleInstance as Module } from './modules/ModuleInstance.js';

// Simple ToolResult for compatibility
export class ToolResult {
  constructor(success, data, message) {
    this.success = success;
    this.data = data;
    this.message = message;
  }
  
  static success(data, message) {
    return new ToolResult(true, data, message);
  }
  
  static failure(message, data) {
    return new ToolResult(false, data, message);
  }
}

// Alias for easier migration
export { ModuleInstance as BaseModule } from './modules/ModuleInstance.js';

// Module implementations moved to @legion/tools-collection

// Integration components
export { ToolRegistry } from './integration/ToolRegistry.js';

// Tool modules are available in their respective directories and can be imported directly:
// import CalculatorModule from '@legion/tools/calculator'
// import FileModule from '@legion/tools/file' 
// import GitHubModule from '@legion/tools/github'
// etc.