/**
 * Testing utilities for ToolRegistry
 * 
 * This module provides test-specific exports that should ONLY be used in tests.
 * Production code should import the singleton instance from the main package.
 */

// Export the class for testing purposes only
export { ToolRegistry } from '../integration/ToolRegistry.js';

/**
 * Reset the ToolRegistry singleton (for testing isolation)
 */
export function resetToolRegistry() {
  const { ToolRegistry } = require('../integration/ToolRegistry.js');
  return ToolRegistry.reset();
}

/**
 * Create a fresh test ToolRegistry instance
 * @param {Object} config - Configuration options
 * @returns {Promise<ToolRegistry>} Fresh ToolRegistry instance
 */
export async function createTestToolRegistry(config = {}) {
  const { ToolRegistry } = await import('../integration/ToolRegistry.js');
  ToolRegistry.reset();
  return await ToolRegistry.getInstance();
}

/**
 * Get current ToolRegistry instance (for test assertions)
 * @returns {Promise<ToolRegistry>} Current instance
 */
export async function getToolRegistryInstance() {
  const { ToolRegistry } = await import('../integration/ToolRegistry.js');
  return await ToolRegistry.getInstance();
}