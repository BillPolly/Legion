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

// Resource management moved to @legion/core - import from there
// export { ResourceManager } from './ResourceManager.js';

// Integration components
import { ToolRegistry } from './integration/ToolRegistry.js';
export { ToolRegistry };

// Export singleton instance directly
// The singleton pattern is handled in the ToolRegistry class itself
const toolRegistry = ToolRegistry.getInstance();
export default toolRegistry;

// Search and discovery services
export { 
  ToolIndexer, 
  SemanticToolDiscovery, 
  DocumentProcessor,
  createToolIndexer,
  createSemanticToolDiscovery
} from './search/index.js';

// Tool modules are available in their respective directories and can be imported directly:
// import CalculatorModule from '@legion/tools-registry/calculator'
// import FileModule from '@legion/tools-registry/file' 
// import GitHubModule from '@legion/tools-registry/github'
// etc.