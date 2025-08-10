/**
 * Module Discovery and Tool Loading System
 * 
 * A comprehensive system for discovering, loading, and managing all module types
 * and tools in the Legion framework.
 */

export { ModuleDiscoveryService } from './ModuleDiscoveryService.js';
export { ModuleInstantiator } from './ModuleInstantiator.js';
export { ToolExtractor } from './ToolExtractor.js';
export { ToolAdapter, ToolExecutionError } from './ToolAdapter.js';
export { ModuleRegistry } from './ModuleRegistry.js';
export { ToolLoader } from './ToolLoader.js';
export { ComprehensiveToolDiscovery } from './ComprehensiveToolDiscovery.js';

// Export as default for convenience
export { ComprehensiveToolDiscovery as default } from './ComprehensiveToolDiscovery.js';

/**
 * Create a fully configured tool loading system
 */
export function createToolSystem(options = {}) {
  const {
    resourceManager,
    strategy = 'hybrid',
    verbose = false,
    ...otherOptions
  } = options;
  
  // Create tool loader with all components
  const toolLoader = new ToolLoader({
    resourceManager,
    strategy,
    verbose,
    ...otherOptions
  });
  
  return {
    loader: toolLoader,
    registry: toolLoader.moduleRegistry,
    
    // Convenience methods
    async initialize() {
      return await toolLoader.initialize();
    },
    
    async getTool(name) {
      return await toolLoader.getTool(name);
    },
    
    async getTools(names) {
      return await toolLoader.getTools(names);
    },
    
    listTools(options) {
      return toolLoader.listTools(options);
    },
    
    searchTools(query, options) {
      return toolLoader.searchTools(query, options);
    },
    
    getStats() {
      return toolLoader.getStats();
    }
  };
}