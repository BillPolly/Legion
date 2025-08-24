/**
 * Main entry point for the tools-registry package
 * 
 * ToolRegistry is a singleton that provides the ONLY entry point
 * to all tools-registry functionality
 */

// Main singleton entry point
export { ToolRegistry } from './integration/ToolRegistry.js';

// Base classes for external modules to extend
export { Module } from './core/Module.js';
export { Tool } from './core/Tool.js';
export { ToolResult } from './core/ToolResult.js';