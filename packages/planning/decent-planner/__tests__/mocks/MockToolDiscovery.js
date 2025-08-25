/**
 * MockToolDiscovery - Simple mock for testing
 * 
 * Provides a simple mock implementation of the tool discovery interface
 * for use in tests without the complexity of ToolDiscoveryBridge
 */

export class MockToolDiscovery {
  constructor(toolProvider) {
    this.toolProvider = toolProvider;
  }

  async initialize() {
    // No-op for mock
  }

  async discoverTools(task, context = {}) {
    // Validate input
    if (task === null || task === undefined) {
      throw new Error('MockToolDiscovery: Task cannot be null or undefined');
    }
    
    const query = typeof task === 'string' ? task : task.description;
    
    if (!query || query.trim() === '') {
      throw new Error('MockToolDiscovery: Task description cannot be empty');
    }
    
    const limit = context.limit || context.maxTools || 10;
    
    // Simple keyword matching for tests
    const allTools = await this.toolProvider.listTools();
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    const matchedTools = allTools.filter(tool => {
      const nameLower = tool.name.toLowerCase();
      const descLower = (tool.description || '').toLowerCase();
      
      // Direct match
      if (nameLower.includes(queryLower) || descLower.includes(queryLower)) {
        return true;
      }
      
      // Keyword match
      return keywords.some(keyword => {
        if (keyword === 'calculate' && nameLower === 'calculator') return true;
        if (keyword === 'read' && nameLower === 'file_read') return true;
        if (keyword === 'write' && nameLower === 'file_write') return true;
        if (keyword === 'parse' && nameLower === 'json_parse') return true;
        if (keyword === 'json' && nameLower === 'json_parse') return true;
        if (keyword === 'file' && (nameLower === 'file_read' || nameLower === 'file_write')) return true;
        return nameLower.includes(keyword) || descLower.includes(keyword);
      });
    });
    
    // Get executable tools
    const executableTools = [];
    for (const tool of matchedTools.slice(0, limit)) {
      // Check if toolProvider has getTool method
      if (typeof this.toolProvider.getTool === 'function') {
        const execTool = await this.toolProvider.getTool(tool.name);
        if (execTool) {
          executableTools.push(execTool);
        }
      } else {
        // If no getTool method, use the tool as-is
        executableTools.push(tool);
      }
    }
    
    return executableTools.slice(0, limit);
  }

  async discoverToolsWithContext(description, contextHints = {}) {
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