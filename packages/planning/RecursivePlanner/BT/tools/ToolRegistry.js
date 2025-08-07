/**
 * ToolRegistry - Central registry for managing and accessing tools
 * Provides unified interface for tool registration, discovery, and execution
 */

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.toolMetadata = new Map();
    this.categories = new Map();
  }

  /**
   * Register a tool in the registry
   * @param {string} name - Tool name/identifier
   * @param {Object} tool - Tool implementation with execute() and getMetadata() methods
   * @param {string} category - Optional category for organization
   */
  async registerTool(name, tool, category = 'general') {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    if (!tool) {
      throw new Error('Tool implementation is required');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute() method');
    }

    if (typeof tool.getMetadata !== 'function') {
      throw new Error('Tool must have a getMetadata() method');
    }

    // Get and validate metadata
    const metadata = tool.getMetadata();
    if (!metadata.name || !metadata.description) {
      throw new Error('Tool metadata must include name and description');
    }

    // Store tool and metadata
    this.tools.set(name, tool);
    this.toolMetadata.set(name, metadata);

    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(name);

    return true;
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Object} Tool implementation
   */
  async getTool(name) {
    if (!this.tools.has(name)) {
      throw new Error(`Tool '${name}' not found in registry`);
    }
    return this.tools.get(name);
  }

  /**
   * Get tool metadata
   * @param {string} name - Tool name
   * @returns {Object} Tool metadata
   */
  getToolMetadata(name) {
    if (!this.toolMetadata.has(name)) {
      throw new Error(`Tool metadata for '${name}' not found`);
    }
    return this.toolMetadata.get(name);
  }

  /**
   * Check if a tool exists
   * @param {string} name - Tool name
   * @returns {boolean} True if tool exists
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   * @returns {Object} Map of all tools
   */
  async getAllTools() {
    const allTools = {};
    for (const [name, tool] of this.tools) {
      allTools[name] = tool;
    }
    return allTools;
  }

  /**
   * Get all tool names
   * @returns {Array<string>} List of tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools by category
   * @param {string} category - Category name
   * @returns {Array<string>} Tool names in category
   */
  getToolsByCategory(category) {
    if (!this.categories.has(category)) {
      return [];
    }
    return Array.from(this.categories.get(category));
  }

  /**
   * Get all categories
   * @returns {Array<string>} List of category names
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Execute a tool with given parameters
   * @param {string} toolName - Name of tool to execute
   * @param {Object} params - Parameters to pass to tool
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, params = {}) {
    const tool = await this.getTool(toolName);
    return await tool.execute(params);
  }

  /**
   * Validate tool parameters against metadata schema
   * @param {string} toolName - Tool name
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateToolParameters(toolName, params) {
    const metadata = this.getToolMetadata(toolName);
    const errors = [];
    const warnings = [];

    if (!metadata.input) {
      return { valid: true, errors, warnings };
    }

    // Check required parameters
    for (const [paramName, paramSpec] of Object.entries(metadata.input)) {
      if (paramSpec.required && !(paramName in params)) {
        errors.push(`Required parameter '${paramName}' is missing`);
      }
    }

    // Check parameter types (basic validation)
    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramSpec = metadata.input[paramName];
      if (paramSpec && paramSpec.type) {
        const actualType = typeof paramValue;
        let expectedType = paramSpec.type;
        
        // Handle array type
        if (expectedType === 'array' && !Array.isArray(paramValue)) {
          errors.push(`Parameter '${paramName}' should be an array, got ${actualType}`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
          // Handle special cases
          if (!(expectedType === 'number' && actualType === 'string' && !isNaN(paramValue))) {
            warnings.push(`Parameter '${paramName}' expected ${expectedType}, got ${actualType}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Unregister a tool
   * @param {string} name - Tool name to remove
   * @returns {boolean} True if tool was removed
   */
  unregisterTool(name) {
    if (!this.tools.has(name)) {
      return false;
    }

    this.tools.delete(name);
    this.toolMetadata.delete(name);

    // Remove from categories
    for (const [category, toolSet] of this.categories) {
      if (toolSet.has(name)) {
        toolSet.delete(name);
        if (toolSet.size === 0) {
          this.categories.delete(category);
        }
      }
    }

    return true;
  }

  /**
   * Clear all tools from registry
   */
  clear() {
    this.tools.clear();
    this.toolMetadata.clear();
    this.categories.clear();
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const categoryStats = {};
    for (const [category, toolSet] of this.categories) {
      categoryStats[category] = toolSet.size;
    }

    return {
      totalTools: this.tools.size,
      categories: this.categories.size,
      categoryBreakdown: categoryStats,
      toolNames: this.getToolNames()
    };
  }

  /**
   * Find tools by search criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array<string>} Matching tool names
   */
  findTools(criteria = {}) {
    const results = [];

    for (const [name, metadata] of this.toolMetadata) {
      let matches = true;

      // Search by name pattern
      if (criteria.namePattern) {
        const regex = new RegExp(criteria.namePattern, 'i');
        if (!regex.test(name)) matches = false;
      }

      // Search by description pattern
      if (criteria.descriptionPattern) {
        const regex = new RegExp(criteria.descriptionPattern, 'i');
        if (!regex.test(metadata.description)) matches = false;
      }

      // Search by category
      if (criteria.category) {
        const categoryTools = this.getToolsByCategory(criteria.category);
        if (!categoryTools.includes(name)) matches = false;
      }

      // Search by input parameter
      if (criteria.hasInput) {
        if (!metadata.input || !metadata.input[criteria.hasInput]) {
          matches = false;
        }
      }

      if (matches) {
        results.push(name);
      }
    }

    return results;
  }

  /**
   * Export registry configuration
   * @returns {Object} Registry configuration
   */
  exportConfig() {
    const config = {
      tools: {},
      categories: {}
    };

    for (const [name, metadata] of this.toolMetadata) {
      config.tools[name] = {
        metadata,
        category: this.findToolCategory(name)
      };
    }

    for (const [category, toolSet] of this.categories) {
      config.categories[category] = Array.from(toolSet);
    }

    return config;
  }

  /**
   * Find which category a tool belongs to
   * @param {string} toolName - Tool name
   * @returns {string} Category name
   */
  findToolCategory(toolName) {
    for (const [category, toolSet] of this.categories) {
      if (toolSet.has(toolName)) {
        return category;
      }
    }
    return 'general';
  }

  /**
   * Bulk register tools from configuration
   * @param {Object} toolConfig - Configuration object with tools
   */
  async bulkRegister(toolConfig) {
    if (!toolConfig.tools) {
      throw new Error('Tool configuration must have a "tools" property');
    }

    const results = [];
    for (const [name, config] of Object.entries(toolConfig.tools)) {
      try {
        if (config.implementation) {
          await this.registerTool(name, config.implementation, config.category);
          results.push({ name, success: true });
        } else {
          results.push({ name, success: false, error: 'No implementation provided' });
        }
      } catch (error) {
        results.push({ name, success: false, error: error.message });
      }
    }

    return results;
  }
}