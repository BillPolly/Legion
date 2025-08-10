/**
 * ToolDiscoveryBridge - Interface to @legion/tools semantic search
 * 
 * Maps simple tasks to relevant tools using the existing SemanticToolSearch
 * from the tools package, which provides MongoDB-backed tool registry with
 * ONNX embeddings and natural language search
 */

import { ToolRegistry } from '@legion/tools';
import { SemanticToolSearch } from '@legion/tools/src/semantic/SemanticToolSearch.js';

export class ToolDiscoveryBridge {
  constructor(resourceManager, toolRegistryProvider) {
    this.resourceManager = resourceManager;
    this.toolRegistryProvider = toolRegistryProvider;
    this.semanticSearch = null;
    this.toolRegistry = null;
  }

  async initialize() {
    // Initialize the semantic search from tools package
    this.semanticSearch = await SemanticToolSearch.create(
      this.resourceManager,
      this.toolRegistryProvider
    );
    
    // Initialize tool registry for getting executable tools
    this.toolRegistry = new ToolRegistry({ 
      provider: this.toolRegistryProvider 
    });
    await this.toolRegistry.initialize();
  }

  /**
   * Discover relevant tools for a simple task
   * @param {Object} task - Simple task description
   * @param {Object} context - Task context
   * @returns {Promise<Array>} Relevant executable tools
   */
  async discoverTools(task, context = {}) {
    // Use the existing semantic search from tools package
    const searchResults = await this.semanticSearch.searchTools(
      task.description,
      {
        limit: context.maxTools || 10,
        threshold: context.threshold || 0.3
      }
    );

    // Get executable tools from registry
    const executableTools = [];
    for (const result of searchResults) {
      const tool = await this.toolRegistry.getTool(result.name);
      if (tool) {
        executableTools.push(tool);
      }
    }

    return executableTools;
  }
}