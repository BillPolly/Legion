/**
 * @jsenvoy/modules - Core infrastructure for building modular tool systems
 * 
 * This package provides the essential infrastructure for creating extensible
 * tool libraries with dependency injection and modular architecture.
 */

// Export core infrastructure
export { default as ResourceManager } from "./ResourceManager.js";
export { ModuleFactory } from "./ModuleFactory.js";

// Export base classes
export { default as Tool } from "./Tool.js";
export { default as ToolResult } from "./ToolResult.js";
export { Module } from "./Module.js";
export { ModularTool } from "./ModularTool.js";
