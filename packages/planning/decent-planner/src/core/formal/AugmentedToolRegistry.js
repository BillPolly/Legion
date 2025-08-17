/**
 * AugmentedToolRegistry - Wraps real ToolRegistry and adds synthetic tools
 */

export class AugmentedToolRegistry {
  constructor(realToolRegistry) {
    this.realTools = realToolRegistry;
    this.syntheticTools = new Map();
  }

  /**
   * Add a synthetic tool to the registry
   */
  addSyntheticTool(tool) {
    this.syntheticTools.set(tool.name, tool);
  }

  /**
   * Clear all synthetic tools
   */
  clearSyntheticTools() {
    this.syntheticTools.clear();
  }

  /**
   * Get all synthetic tools
   */
  getAllSyntheticTools() {
    return Array.from(this.syntheticTools.values());
  }

  /**
   * Search for tools (both real and synthetic)
   */
  async searchTools(query, options) {
    // Search real tools
    const realResults = await this.realTools.searchTools(query, options);
    
    // Search synthetic tools
    const syntheticResults = this.searchSynthetic(query);
    
    // Combine results
    return [...realResults, ...syntheticResults];
  }

  /**
   * Get a tool by name (real or synthetic)
   */
  async getTool(name) {
    // Check synthetic tools first (they override real tools)
    if (this.syntheticTools.has(name)) {
      return this.syntheticTools.get(name);
    }
    
    // Fall back to real tools
    return await this.realTools.getTool(name);
  }

  /**
   * Search synthetic tools by query
   */
  searchSynthetic(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [name, tool] of this.syntheticTools) {
      const nameLower = name.toLowerCase();
      const descriptionLower = (tool.description || '').toLowerCase();
      
      // Simple text matching for synthetic tools
      if (nameLower.includes(queryLower) || descriptionLower.includes(queryLower)) {
        // Calculate simple confidence score based on match quality
        let confidence = 0.5;
        if (nameLower === queryLower || descriptionLower === queryLower) {
          confidence = 0.95;
        } else if (nameLower.startsWith(queryLower) || descriptionLower.startsWith(queryLower)) {
          confidence = 0.8;
        } else if (nameLower.includes(queryLower)) {
          confidence = 0.7;
        }
        
        results.push({
          name: tool.name,
          description: tool.description,
          confidence,
          type: 'synthetic'
        });
      }
    }
    
    return results;
  }
}