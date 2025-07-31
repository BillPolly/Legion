/**
 * @legion/module-loader - Simple module loading for Legion tools
 * 
 * Primary export: ModuleLoader - the ONE object you need to load modules
 */

// PRIMARY EXPORT - Simple module loader (use this!)
export { default as ModuleLoader } from "./ModuleLoader.js";

// Core infrastructure (usually only needed internally)
export { default as ResourceManager } from "./resources/ResourceManager.js";
export { getResourceManager } from "./resources/getResourceManager.js";

// NEW RECOMMENDED: Simple base classes for tools and modules
export { SimpleTool } from "./tool/SimpleTool.js";
export { SimpleModule } from "./module/SimpleModule.js";

// Adapters for compatibility
export { OpenAIToolAdapter } from "./tool/adapters/OpenAIToolAdapter.js";
export { LegacyToolAdapter, adaptLegacyTool } from "./tool/adapters/LegacyToolAdapter.js";

// LEGACY: Old base classes (use SimpleTool/SimpleModule instead)
export { default as Tool } from "./tool/Tool.js";
export { default as ToolResult } from "./tool/ToolResult.js";
export { Module } from "./module/Module.js";

// Internal components (avoid using these directly)
export { ModuleFactory } from "./module/ModuleFactory.js";
export { ModuleManager } from "./module/ModuleManager.js";
export { ModuleRegistry } from "./module/ModuleRegistry.js";
