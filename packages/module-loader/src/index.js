/**
 * @legion/module-loader - Clean module and tool system for Legion
 * 
 * Primary export: ModuleLoader - the main interface for loading modules
 */

// PRIMARY EXPORT - Main module loader
export { default as ModuleLoader } from "./ModuleLoader.js";

// Core base classes for building tools and modules
export { default as Tool } from "./tool/Tool.js";
export { Module } from "./module/Module.js";
export { GenericTool } from "./tool/GenericTool.js";
export { GenericModule } from "./module/GenericModule.js";

// Resource management
export { default as ResourceManager } from "./resources/ResourceManager.js";
export { getResourceManager } from "./resources/getResourceManager.js";

// Tool result handling
export { default as ToolResult } from "./tool/ToolResult.js";

// Adapters for backward compatibility
export { OpenAIToolAdapter } from "./tool/adapters/OpenAIToolAdapter.js";
export { LegacyToolAdapter, adaptLegacyTool } from "./tool/adapters/LegacyToolAdapter.js";

// Module system components
export { ModuleFactory } from "./module/ModuleFactory.js";
export { ModuleManager } from "./module/ModuleManager.js";
export { ModuleRegistry } from "./module/ModuleRegistry.js";
export { JsonModuleLoader } from "./module/JsonModuleLoader.js";
