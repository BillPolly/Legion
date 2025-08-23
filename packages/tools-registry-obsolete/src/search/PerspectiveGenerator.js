/**
 * PerspectiveGenerator - Generates multiple text perspectives for tools
 * 
 * Creates different textual representations of a tool to improve semantic search:
 * - Usage perspective: How to use the tool
 * - Implementation perspective: What the tool does technically
 * - Search perspective: Keywords and variations for finding the tool
 */

export class PerspectiveGenerator {
  constructor() {
    this.perspectiveTypes = ['usage', 'implementation', 'search'];
  }

  /**
   * Generate perspectives for a single tool
   * @param {Object} tool - Tool object with name, description, etc.
   * @returns {Array} Array of perspective objects
   */
  async generatePerspectives(tool) {
    const perspectives = [];

    // Usage perspective - how to use the tool
    perspectives.push({
      perspectiveType: 'usage',
      perspectiveText: this.generateUsagePerspective(tool),
      metadata: {
        type: 'usage',
        toolName: tool.name,
        toolId: tool._id
      }
    });

    // Implementation perspective - what it does technically
    perspectives.push({
      perspectiveType: 'implementation',
      perspectiveText: this.generateImplementationPerspective(tool),
      metadata: {
        type: 'implementation',
        toolName: tool.name,
        toolId: tool._id
      }
    });

    // Search perspective - keywords and variations
    perspectives.push({
      perspectiveType: 'search',
      perspectiveText: this.generateSearchPerspective(tool),
      metadata: {
        type: 'search',
        toolName: tool.name,
        toolId: tool._id
      }
    });

    return perspectives;
  }

  /**
   * Generate usage perspective text
   */
  generateUsagePerspective(tool) {
    const parts = [];
    
    // Tool name and basic usage
    parts.push(`Use ${tool.name} to ${tool.description || 'perform its function'}`);
    
    // Add input parameter info if available
    if (tool.inputSchema && tool.inputSchema.properties) {
      const params = Object.keys(tool.inputSchema.properties);
      if (params.length > 0) {
        parts.push(`Requires parameters: ${params.join(', ')}`);
      }
    }
    
    // Add category/module info
    if (tool.moduleName) {
      parts.push(`Part of ${tool.moduleName} module`);
    }
    
    return parts.join('. ');
  }

  /**
   * Generate implementation perspective text
   */
  generateImplementationPerspective(tool) {
    const parts = [];
    
    // Technical description
    parts.push(`${tool.name} tool implementation`);
    
    if (tool.description) {
      parts.push(tool.description);
    }
    
    // Input/output info
    if (tool.inputSchema) {
      const hasRequired = tool.inputSchema.required && tool.inputSchema.required.length > 0;
      if (hasRequired) {
        parts.push(`Required inputs: ${tool.inputSchema.required.join(', ')}`);
      }
    }
    
    // Module and category
    if (tool.moduleName) {
      parts.push(`Module: ${tool.moduleName}`);
    }
    
    if (tool.category) {
      parts.push(`Category: ${tool.category}`);
    }
    
    return parts.join('. ');
  }

  /**
   * Generate search perspective text
   */
  generateSearchPerspective(tool) {
    const keywords = [];
    
    // Tool name variations
    keywords.push(tool.name);
    
    // Snake_case to space separated
    keywords.push(tool.name.replace(/_/g, ' '));
    
    // CamelCase to space separated
    keywords.push(tool.name.replace(/([A-Z])/g, ' $1').trim());
    
    // Add description keywords
    if (tool.description) {
      // Extract key words from description
      const words = tool.description.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'into'].includes(w));
      keywords.push(...words);
    }
    
    // Add module name
    if (tool.moduleName) {
      keywords.push(tool.moduleName.toLowerCase());
    }
    
    // Add category
    if (tool.category) {
      keywords.push(tool.category.toLowerCase());
    }
    
    // Remove duplicates and join
    return [...new Set(keywords)].join(' ');
  }

  /**
   * Generate perspectives for multiple tools
   */
  async generatePerspectivesForTools(tools) {
    const allPerspectives = [];
    
    for (const tool of tools) {
      const perspectives = await this.generatePerspectives(tool);
      allPerspectives.push(...perspectives);
    }
    
    return allPerspectives;
  }
}