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

// Compatibility exports for migration from module-loader
export { 
  Module,
  ToolResult,
  CompatTool as LegacyTool,
  CompatResourceManager 
} from './compatibility.js';

// Additional compatibility exports
export {
  GenericTool,
  GenericModule,
  OpenAIToolAdapter,
  LegacyToolAdapter,
  adaptLegacyTool,
  ModuleManager,
  ModuleRegistry,
  JsonModuleLoader,
  getResourceManager
} from './additional-compat.js';

// Alias for easier migration
export { ModuleInstance as BaseModule } from './modules/ModuleInstance.js';

// Module implementations
export { FileSystemModuleDefinition, FileSystemModuleInstance } from './modules/FileSystemModule.js';
export { GitModuleDefinition, GitModuleInstance } from './modules/GitModule.js';
export { HTTPModuleDefinition, HTTPModuleInstance } from './modules/HTTPModule.js';
export { UtilityModuleDefinition, UtilityModuleInstance } from './modules/UtilityModule.js';

// Integration components
export { ToolRegistry } from './integration/ToolRegistry.js';
export { ConfigurationManager } from './integration/ConfigurationManager.js';

// Singleton ToolRegistry instance
import { ToolRegistry } from './integration/ToolRegistry.js';
export const toolRegistry = new ToolRegistry();

// Utilities
export { CLIWrapper, createCLITool } from './utils/CLIWrapper.js';
export { parseToolConfiguration, validateToolSchema } from './utils/ConfigurationWrapper.js';
export { ToolError, createStandardError } from './utils/ErrorHandling.js';
export { EventEmitter } from './utils/EventEmitter.js';
export { generateHandle, validateHandleStructure } from './utils/HandleManager.js';
export { NodeModuleWrapper, NPMPackageWrapper } from './utils/LibraryIntegration.js';
export { wrapMethod, wrapAsyncMethod } from './utils/MethodWrapper.js';
export { createToolFromMethod, createToolFromFunction } from './utils/ToolFactory.js';
export { ValidationError, validateParameter } from './utils/Validation.js';

// Tool modules are available in their respective directories and can be imported directly:
// import CalculatorModule from '@legion/tools/calculator'
// import FileModule from '@legion/tools/file' 
// import GitHubModule from '@legion/tools/github'
// etc.