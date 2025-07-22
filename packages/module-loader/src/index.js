/**
 * @legion/module-loader - Core infrastructure for building modular tool systems
 * 
 * This package provides the essential infrastructure for creating extensible
 * tool libraries with dependency injection and modular architecture.
 */

// Export core infrastructure
export { default as ResourceManager } from "./resources/ResourceManager.js";
export { ModuleFactory } from "./module/ModuleFactory.js";

// Export base classes
export { default as Tool } from "./tool/Tool.js";
export { default as ToolResult } from "./tool/ToolResult.js";
export { Module } from "./module/Module.js";
