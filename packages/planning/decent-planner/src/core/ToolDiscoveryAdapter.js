/**
 * ToolDiscoveryAdapter - Adapter for SemanticToolDiscovery
 * 
 * Adapts the SemanticToolDiscovery interface to match what PlanSynthesizer expects.
 * Maps discoverTools() calls to findRelevantTools() and handles the response format.
 */

export class ToolDiscoveryAdapter {
  constructor(semanticDiscovery, toolRegistry) {
    this.semanticDiscovery = semanticDiscovery;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Discover relevant tools for a task (adapter method)
   * @param {Object|string} task - Task description or object with description
   * @param {Object} context - Discovery context with limit, threshold, etc.
   * @returns {Promise<Array>} Array of executable tools
   */
  async discoverTools(task, context = {}) {
    // Validate input
    if (task === null || task === undefined) {
      throw new Error('ToolDiscoveryAdapter: Task cannot be null or undefined');
    }
    
    // Handle both string and object inputs
    const query = typeof task === 'string' ? task : task.description;
    
    if (!query || query.trim() === '') {
      throw new Error('ToolDiscoveryAdapter: Task description cannot be empty');
    }
    
    console.log(`[ToolDiscoveryAdapter] Searching for tools matching: "${query}"`);
    
    // Get options from context
    const limit = context.limit || context.maxTools || 10;
    const threshold = context.threshold || 0.3;
    
    try {
      // Use the same searchTools method as manual search (with our fixed aggregation)
      const searchResults = await this.toolRegistry.searchTools(query, {
        limit: limit
      });
      
      console.log(`[ToolDiscoveryAdapter] Search found ${searchResults.length} matching tools:`, 
        searchResults.map(r => r.name).filter(Boolean));

      // Filter by confidence threshold and return tools that already have execute functions
      const filteredTools = searchResults.filter(tool => {
        const confidence = tool.confidence || 0;
        return confidence >= threshold;
      });
      
      console.log(`[ToolDiscoveryAdapter] After confidence filtering (>=${threshold}): ${filteredTools.length} tools`);
      
      return filteredTools.slice(0, limit);
    } catch (error) {
      console.error('[ToolDiscoveryAdapter] Error in semantic search:', error.message);
      // Fallback to empty array on error
      return [];
    }
  }
  
  /**
   * Discover tools with context hints (for compatibility)
   * @param {string} description - Task description
   * @param {Object} contextHints - Context hints with inputs/outputs
   * @returns {Promise<Array>} Relevant executable tools
   */
  async discoverToolsWithContext(description, contextHints = {}) {
    // Build enhanced query using context hints
    let enhancedQuery = description;
    
    if (contextHints.description) {
      enhancedQuery = contextHints.description;
    }
    
    if (contextHints.inputs && contextHints.inputs.length > 0) {
      enhancedQuery += ` with inputs: ${contextHints.inputs.join(', ')}`;
    }
    
    if (contextHints.outputs && contextHints.outputs.length > 0) {
      enhancedQuery += ` producing outputs: ${contextHints.outputs.join(', ')}`;
    }
    
    // Use the enhanced query for discovery
    return this.discoverTools({
      description: enhancedQuery,
      suggestedInputs: contextHints.inputs,
      suggestedOutputs: contextHints.outputs
    }, {
      maxTools: contextHints.limit || 10,
      threshold: contextHints.threshold || 0.3
    });
  }
}