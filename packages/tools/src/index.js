/**
 * Tool Architecture Framework - Main Entry Point
 * 
 * Complete tools package with both tool modules and core infrastructure
 */

// Core module components
export { ModuleDefinition } from './modules/ModuleDefinition.js';
export { Module } from './modules/Module.js';
export { Tool } from './modules/Tool.js';
export { ToolResult } from './modules/ToolResult.js';

// Resource management  
export { ResourceManager } from './ResourceManager.js';


// Integration components
export { ToolRegistry } from './integration/ToolRegistry.js';

// Tool modules are available in their respective directories and can be imported directly:
// import CalculatorModule from '@legion/tools/calculator'
// import FileModule from '@legion/tools/file' 
// import GitHubModule from '@legion/tools/github'
// etc.