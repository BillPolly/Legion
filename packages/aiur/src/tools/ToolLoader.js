/**
 * ToolLoader - Dynamic tool loading and management for Legion tools
 * 
 * Handles discovery, loading, and management of Legion tools with MCP integration
 */

export class ToolLoader {
  constructor(mcpAdapter, options = {}) {
    this.adapter = mcpAdapter;
    this.options = {
      allowOverwrite: options.allowOverwrite !== false,
      validateOnLoad: options.validateOnLoad !== false,
      trackUsage: options.trackUsage !== false,
      ...options
    };

    // Tool storage
    this.tools = new Map();
    this.toolMetadata = new Map();
    
    // Usage tracking
    this.executionCounts = new Map();
    this.lastExecuted = new Map();
    
    // Categories and tags for organization
    this.categories = new Set();
    this.tags = new Set();
  }

  /**
   * Load tools from a Legion module
   * @param {Object} module - Legion module containing tools
   */
  loadFromModule(module) {
    if (!module || typeof module !== 'object') {
      throw new Error('Module must be an object');
    }

    if (!module.tools || !Array.isArray(module.tools)) {
      throw new Error('Module tools must be an array');
    }

    const moduleName = module.name || 'unnamed-module';
    
    for (const tool of module.tools) {
      this._loadSingleTool(tool, { moduleName });
    }
  }

  /**
   * Load tools from an array
   * @param {Array} tools - Array of Legion tools
   */
  loadFromArray(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }

    for (const tool of tools) {
      this._loadSingleTool(tool);
    }
  }

  /**
   * Load a single tool
   * @private
   */
  _loadSingleTool(tool, metadata = {}) {
    // Validate tool
    if (this.options.validateOnLoad) {
      const compatibility = this.validateToolCompatibility(tool);
      if (!compatibility.compatible) {
        throw new Error(`Tool validation failed: ${compatibility.issues.join(', ')}`);
      }
    }

    // Check for duplicates
    if (this.tools.has(tool.name) && !this.options.allowOverwrite) {
      throw new Error(`Tool already exists: ${tool.name}`);
    }

    try {
      // Wrap tool with MCP adapter
      const wrappedTool = this.adapter.wrapTool(tool);
      
      // Store tool and metadata
      this.tools.set(tool.name, wrappedTool);
      this.toolMetadata.set(tool.name, {
        originalTool: tool,
        loadedAt: new Date(),
        category: tool.category || 'uncategorized',
        tags: tool.tags || [],
        ...metadata
      });

      // Track categories and tags
      if (tool.category) {
        this.categories.add(tool.category);
      }
      if (tool.tags) {
        tool.tags.forEach(tag => this.tags.add(tag));
      }

      // Initialize usage tracking
      if (this.options.trackUsage) {
        this.executionCounts.set(tool.name, 0);
      }

    } catch (error) {
      throw new Error(`Failed to load tool '${tool.name}': ${error.message}`);
    }
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Object|null} The tool or null if not found
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Check if a tool is loaded
   * @param {string} name - Tool name
   * @returns {boolean} True if tool exists
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * Get all loaded tools
   * @returns {Array} Array of all tools
   */
  getLoadedTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool count
   * @returns {number} Number of loaded tools
   */
  getToolCount() {
    return this.tools.size;
  }

  /**
   * Get tools by category
   * @param {string} category - Category name
   * @returns {Array} Array of tools in the category
   */
  getToolsByCategory(category) {
    const tools = [];
    for (const [name, tool] of this.tools) {
      const metadata = this.toolMetadata.get(name);
      if (metadata && metadata.category === category) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Search tools by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} Array of matching tools
   */
  searchTools(criteria = {}) {
    const {
      namePattern,
      descriptionKeywords,
      category,
      tags,
      moduleName
    } = criteria;

    const results = [];

    for (const [name, tool] of this.tools) {
      const metadata = this.toolMetadata.get(name);
      const originalTool = metadata.originalTool;

      let matches = true;

      // Check name pattern
      if (namePattern && !namePattern.test(name)) {
        matches = false;
      }

      // Check description keywords
      if (descriptionKeywords && originalTool.description) {
        const description = originalTool.description.toLowerCase();
        const hasKeywords = descriptionKeywords.some(keyword => 
          description.includes(keyword.toLowerCase())
        );
        if (!hasKeywords) {
          matches = false;
        }
      }

      // Check category
      if (category && metadata.category !== category) {
        matches = false;
      }

      // Check tags
      if (tags && originalTool.tags) {
        const hasAllTags = tags.every(tag => originalTool.tags.includes(tag));
        if (!hasAllTags) {
          matches = false;
        }
      }

      // Check module name
      if (moduleName && metadata.moduleName !== moduleName) {
        matches = false;
      }

      if (matches) {
        results.push(tool);
      }
    }

    return results;
  }

  /**
   * Execute a tool by name
   * @param {string} name - Tool name
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(name, params = {}) {
    const tool = this.getTool(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`
      };
    }

    try {
      // Track usage if enabled
      if (this.options.trackUsage) {
        this.executionCounts.set(name, (this.executionCounts.get(name) || 0) + 1);
        this.lastExecuted.set(name, new Date());
      }

      // Execute the tool
      return await tool.execute(params);
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`
      };
    }
  }

  /**
   * Unload a specific tool
   * @param {string} name - Tool name to unload
   * @returns {boolean} True if tool was unloaded
   */
  unloadTool(name) {
    if (!this.tools.has(name)) {
      return false;
    }

    this.tools.delete(name);
    this.toolMetadata.delete(name);
    this.executionCounts.delete(name);
    this.lastExecuted.delete(name);

    return true;
  }

  /**
   * Clear all loaded tools
   */
  clear() {
    this.tools.clear();
    this.toolMetadata.clear();
    this.executionCounts.clear();
    this.lastExecuted.clear();
    this.categories.clear();
    this.tags.clear();
  }

  /**
   * Reload tools from a new source
   * @param {Array} newTools - New tools to load
   */
  reload(newTools) {
    this.clear();
    this.loadFromArray(newTools);
  }

  /**
   * Validate tool compatibility
   * @param {Object} tool - Tool to validate
   * @returns {Object} Compatibility report
   */
  validateToolCompatibility(tool) {
    return this.adapter.testToolCompatibility(tool);
  }

  /**
   * Get available categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Get available tags
   * @returns {Array} Array of tag names
   */
  getTags() {
    return Array.from(this.tags);
  }

  /**
   * Get tool statistics
   * @returns {Object} Statistics about loaded tools
   */
  getStatistics() {
    const categoryCounts = {};
    for (const category of this.categories) {
      categoryCounts[category] = this.getToolsByCategory(category).length;
    }

    const stats = {
      totalTools: this.tools.size,
      categories: this.getCategories(),
      tags: this.getTags(),
      categoryCounts,
      toolNames: Array.from(this.tools.keys())
    };

    if (this.options.trackUsage) {
      stats.executionCounts = Object.fromEntries(this.executionCounts);
      stats.totalExecutions = Array.from(this.executionCounts.values()).reduce((sum, count) => sum + count, 0);
      
      // Most used tools
      const sortedByUsage = Array.from(this.executionCounts.entries())
        .sort(([, a], [, b]) => b - a);
      stats.mostUsedTools = sortedByUsage.slice(0, 5);
    }

    return stats;
  }

  /**
   * Get health information
   * @returns {Object} Health status information
   */
  getHealthInfo() {
    return {
      status: this.tools.size > 0 ? 'healthy' : 'empty',
      toolsLoaded: this.tools.size,
      categoriesAvailable: this.categories.size,
      tagsAvailable: this.tags.size,
      adapterStatus: 'operational',
      lastActivity: this.options.trackUsage ? 
        Array.from(this.lastExecuted.values()).sort().pop() : null
    };
  }

  /**
   * Export tool registry for persistence
   * @returns {Object} Exportable registry data
   */
  exportRegistry() {
    const exported = {
      tools: [],
      metadata: Object.fromEntries(this.toolMetadata),
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString()
    };

    for (const [name, metadata] of this.toolMetadata) {
      exported.tools.push({
        name,
        ...metadata.originalTool
      });
    }

    return exported;
  }

  /**
   * Import tool registry from exported data
   * @param {Object} exportedData - Previously exported registry data
   */
  importRegistry(exportedData) {
    if (!exportedData.tools || !Array.isArray(exportedData.tools)) {
      throw new Error('Invalid exported data format');
    }

    this.clear();
    this.loadFromArray(exportedData.tools);

    // Restore usage statistics if available
    if (this.options.trackUsage && exportedData.statistics && exportedData.statistics.executionCounts) {
      for (const [name, count] of Object.entries(exportedData.statistics.executionCounts)) {
        if (this.tools.has(name)) {
          this.executionCounts.set(name, count);
        }
      }
    }
  }

  /**
   * Create a filtered tool loader
   * @param {Object} criteria - Filter criteria
   * @returns {ToolLoader} New ToolLoader with filtered tools
   */
  createFilteredLoader(criteria) {
    const filteredTools = this.searchTools(criteria);
    const newLoader = new ToolLoader(this.adapter, this.options);
    
    for (const tool of filteredTools) {
      const metadata = this.toolMetadata.get(tool.name);
      if (metadata) {
        newLoader._loadSingleTool(metadata.originalTool, metadata);
      }
    }
    
    return newLoader;
  }
}