/**
 * Main entry point for the tools-registry package
 * 
 * Exports the initialized ToolRegistry singleton instance as default
 * This prevents incorrect usage and ensures proper singleton pattern
 * 
 * IMPORTANT: DO NOT EXPORT THE CLASS!
 * Only the singleton instance should be used throughout the entire application.
 * For tests, use ToolRegistry.getInstance() by importing from the integration file directly.
 */

import { ToolRegistry } from './integration/ToolRegistry.js';

// Export a lazy-loaded singleton getter instead of initializing at import time
// This prevents initialization issues during testing
let _toolRegistryInstance = null;

export async function getToolRegistry() {
  if (!_toolRegistryInstance) {
    _toolRegistryInstance = await ToolRegistry.getInstance();
  }
  return _toolRegistryInstance;
}

// Default export for backward compatibility
export default { getToolRegistry };

// Base classes for external modules to extend
export { Module } from './core/Module.js';
export { Tool } from './core/Tool.js';
export { ToolResult } from './core/ToolResult.js';
export { SimpleEmitter } from './core/SimpleEmitter.js';

// Verification framework exports
export { 
  MetadataManager,
  ToolValidator,
  ToolTester,
  TestRunner,
  ReportGenerator,
  AutoFixer 
} from './verification/index.js';