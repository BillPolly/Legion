/**
 * Factory functions for creating tools
 */

import { AtomicTool } from '../core/execution/tools/index.js';
import { config } from '../runtime/config/index.js';

/**
 * Factory function for creating atomic tools
 * @param {string} name - Tool name
 * @param {string} description - Tool description  
 * @param {Function} implementation - Tool implementation function
 * @param {Object} options - Additional options
 * @returns {AtomicTool} Configured atomic tool
 */
export function createTool(name, description, implementation, options = {}) {
  // Get framework defaults from config
  const frameworkConfig = config.get('framework.tool', {});
  
  const toolConfig = {
    timeout: options.timeout ?? frameworkConfig.timeout ?? 30000,
    retries: options.retries ?? frameworkConfig.retries ?? 0,
    cacheResults: options.cacheResults ?? frameworkConfig.cacheResults ?? false,
    debugMode: options.debugMode ?? frameworkConfig.debugMode ?? false,
    retryDelay: options.retryDelay ?? frameworkConfig.retryDelay ?? 1000,
    cacheTTL: options.cacheTTL ?? frameworkConfig.cacheTTL ?? 300000,
    enableMetrics: options.enableMetrics ?? frameworkConfig.enableMetrics ?? true
  };

  return new AtomicTool(name, description, implementation, options.validator, toolConfig);
}