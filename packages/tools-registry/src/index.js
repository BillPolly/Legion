/**
 * Main entry point for the tools-registry package
 * 
 * Primary Interface:
 * - ToolRegistry: Main singleton interface for all tool operations
 * 
 * Specialized Interfaces (Optional):
 * - ToolConsumer: Focused interface for production tool consumption
 * - ToolManager: Focused interface for administrative operations
 * 
 * Uncle Bob's Clean Architecture:
 * - ToolRegistry is the main singleton that everyone should use
 * - ToolConsumer/ToolManager are optional facades for specific use cases
 * - All interfaces share the same underlying ToolRegistry singleton
 * 
 * Usage:
 * - Recommended: Use getToolRegistry() for all operations
 * - Specialized: Use getToolConsumer() for focused tool consumption
 * - Administrative: Use getToolManager() for system administration
 */

import { ToolConsumer } from './consumer/ToolConsumer.js';
import { ToolManager } from './management/ToolManager.js';
import { ToolRegistry } from './integration/ToolRegistry.js';

// Lazy-loaded singleton instances
let _toolConsumerInstance = null;
let _toolManagerInstance = null;
let _toolRegistryInstance = null;

// Shared ServiceOrchestrator to ensure system state consistency
let _sharedServiceOrchestrator = null;

/**
 * Get ToolConsumer instance for specialized tool consumption
 * Focused interface for: getTool, searchTools, executeTool
 * Note: Consider using getToolRegistry() instead for full functionality
 */
export async function getToolConsumer(options = {}) {
  if (!_toolConsumerInstance) {
    _toolConsumerInstance = await ToolConsumer.getInstance(options);
  }
  return _toolConsumerInstance;
}

/**
 * Get ToolManager instance for specialized administrative operations
 * Focused interface for: discoverModules, loadModule, generatePerspectives, etc.
 * Note: Consider using getToolRegistry() instead for full functionality
 */
export async function getToolManager(options = {}) {
  if (!_toolManagerInstance) {
    _toolManagerInstance = await ToolManager.getInstance(options);
  }
  return _toolManagerInstance;
}

/**
 * Get ToolRegistry instance - PRIMARY INTERFACE
 * Complete functionality: All tool operations, module management, search, etc.
 * This is the main singleton interface that provides full access to all features.
 */
export async function getToolRegistry() {
  if (!_toolRegistryInstance) {
    _toolRegistryInstance = await ToolRegistry.getInstance();
  }
  return _toolRegistryInstance;
}

// Default export with primary interface first
export default { 
  getToolRegistry,  // Primary interface - recommended for all use cases
  getToolConsumer,  // Specialized interface for tool consumption
  getToolManager    // Specialized interface for administration
};

// Base classes for external modules to extend
export { Module } from './core/Module.js';
export { Tool } from './core/Tool.js';
export { ToolResult } from './core/ToolResult.js';
export { SimpleEmitter } from './core/SimpleEmitter.js';

// Export classes for testing (but use getInstance() methods in production)
export { ToolConsumer } from './consumer/ToolConsumer.js';
export { ToolManager } from './management/ToolManager.js';
export { ToolRegistry } from './integration/ToolRegistry.js';

// Verification framework exports
export { 
  MetadataManager,
  ToolValidator,
  ToolTester,
  TestRunner,
  ReportGenerator,
  AutoFixer 
} from './verification/index.js';