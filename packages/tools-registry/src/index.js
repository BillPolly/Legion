/**
 * Main entry point for the tools-registry package
 * 
 * Clean Architecture Interfaces:
 * - ToolConsumer: Production interface for fast tool operations
 * - ToolManager: Administrative interface for system management
 * 
 * Uncle Bob's Clean Architecture:
 * - Interface Segregation: Separate consumer and management concerns
 * - Single Responsibility: Each interface serves one specific use case
 * - Dependency Inversion: Both depend on abstractions
 * 
 * Usage:
 * - Production apps: Use getToolConsumer()
 * - Administrative tools: Use getToolManager()
 * - Legacy compatibility: Use getToolRegistry()
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
 * Get ToolConsumer instance for production use
 * Fast tool operations: getTool, searchTools, executeTool
 */
export async function getToolConsumer(options = {}) {
  if (!_toolConsumerInstance) {
    _toolConsumerInstance = await ToolConsumer.getInstance(options);
  }
  return _toolConsumerInstance;
}

/**
 * Get ToolManager instance for administrative use
 * System management: discoverModules, loadModule, generatePerspectives, etc.
 */
export async function getToolManager(options = {}) {
  if (!_toolManagerInstance) {
    _toolManagerInstance = await ToolManager.getInstance(options);
  }
  return _toolManagerInstance;
}

/**
 * Get ToolRegistry instance (legacy compatibility)
 * @deprecated Use getToolConsumer() or getToolManager() instead
 */
export async function getToolRegistry() {
  if (!_toolRegistryInstance) {
    _toolRegistryInstance = await ToolRegistry.getInstance();
  }
  return _toolRegistryInstance;
}

// Default export with clean interfaces
export default { 
  getToolConsumer,
  getToolManager,
  getToolRegistry  // Legacy compatibility
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