/**
 * ToolRegistry - Tool indexing and metadata management system
 * 
 * Provides comprehensive tool registration, search, and relationship tracking
 */

export class ToolRegistry {
  constructor(options = {}) {
    this.options = {
      allowedCategories: options.allowedCategories || null,
      validateNames: options.validateNames !== false,
      ...options
    };

    // Core storage
    this.tools = new Map();
    this.metadata = new Map();
    this.usage = new Map();
    
    // Indexing structures
    this.categoryIndex = new Map();
    this.tagIndex = new Map();
    
    // Relationships
    this.dependencies = new Map();
    this.dependents = new Map();
    this.groups = new Map();
  }

  /**
   * Register a single tool with metadata
   */
  registerTool(tool, options = {}) {
    this._validateTool(tool);
    
    if (this.tools.has(tool.name) && !options.force) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    // Store the tool
    this.tools.set(tool.name, tool);

    // Generate metadata
    const metadata = this._generateMetadata(tool);
    this.metadata.set(tool.name, metadata);

    // Initialize usage tracking
    if (!this.usage.has(tool.name)) {
      this.usage.set(tool.name, {
        count: 0,
        lastUsed: null
      });
    }

    // Update indexes
    this._updateIndexes(tool.name, metadata);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Check if tool exists
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * Get all tools
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   */
  getToolCount() {
    return this.tools.size;
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category) {
    const toolNames = this.categoryIndex.get(category) || [];
    return toolNames.map(name => this.tools.get(name)).filter(Boolean);
  }

  /**
   * Get tools by tags
   */
  getToolsByTags(tags) {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }

    const matchingTools = new Set();
    
    for (const tag of tags) {
      const toolNames = this.tagIndex.get(tag) || [];
      for (const name of toolNames) {
        matchingTools.add(name);
      }
    }

    return Array.from(matchingTools).map(name => this.tools.get(name)).filter(Boolean);
  }

  /**
   * Search tools with multiple criteria
   */
  searchTools(criteria = {}) {
    let results = Array.from(this.tools.values());

    // Filter by name pattern
    if (criteria.namePattern) {
      results = results.filter(tool => criteria.namePattern.test(tool.name));
    }

    // Filter by description keywords
    if (criteria.descriptionKeywords) {
      const keywords = criteria.descriptionKeywords;
      results = results.filter(tool => {
        const description = (tool.description || '').toLowerCase();
        return keywords.some(keyword => description.includes(keyword.toLowerCase()));
      });
    }

    // Filter by category
    if (criteria.category) {
      results = results.filter(tool => {
        const metadata = this.metadata.get(tool.name);
        return metadata && metadata.category === criteria.category;
      });
    }

    // Filter by tags
    if (criteria.tags) {
      const requiredTags = Array.isArray(criteria.tags) ? criteria.tags : [criteria.tags];
      results = results.filter(tool => {
        const metadata = this.metadata.get(tool.name);
        if (!metadata || !metadata.tags) return false;
        return requiredTags.some(tag => metadata.tags.includes(tag));
      });
    }

    return results;
  }

  /**
   * Fuzzy search tools by name and description
   */
  fuzzySearchTools(query) {
    const tools = Array.from(this.tools.values());
    const queryLower = query.toLowerCase();

    return tools.map(tool => {
      const nameScore = this._calculateFuzzyScore(tool.name.toLowerCase(), queryLower);
      const descScore = this._calculateFuzzyScore((tool.description || '').toLowerCase(), queryLower);
      const score = Math.max(nameScore, descScore * 0.8); // Weight name higher

      return { tool, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);
  }

  /**
   * Get tool metadata
   */
  getToolMetadata(name) {
    return this.metadata.get(name) || null;
  }

  /**
   * Update tool metadata
   */
  updateToolMetadata(name, updates) {
    if (!this.tools.has(name)) {
      throw new Error(`Tool not found: ${name}`);
    }

    const currentMetadata = this.metadata.get(name) || {};
    const updatedMetadata = { ...currentMetadata, ...updates };
    
    this.metadata.set(name, updatedMetadata);
    this._updateIndexes(name, updatedMetadata);
  }

  /**
   * Get all categories
   */
  getAllCategories() {
    return Array.from(this.categoryIndex.keys());
  }

  /**
   * Get all tags
   */
  getAllTags() {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * Add dependency relationship
   */
  addDependency(toolName, dependsOnTool) {
    // Check for circular dependencies
    if (this._wouldCreateCircularDependency(toolName, dependsOnTool)) {
      throw new Error('Circular dependency detected');
    }

    // Add dependency
    if (!this.dependencies.has(toolName)) {
      this.dependencies.set(toolName, new Set());
    }
    this.dependencies.get(toolName).add(dependsOnTool);

    // Add to dependents
    if (!this.dependents.has(dependsOnTool)) {
      this.dependents.set(dependsOnTool, new Set());
    }
    this.dependents.get(dependsOnTool).add(toolName);
  }

  /**
   * Get tool dependencies
   */
  getDependencies(toolName) {
    const deps = this.dependencies.get(toolName);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get tools that depend on this tool
   */
  getDependents(toolName) {
    const deps = this.dependents.get(toolName);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Create tool group
   */
  createGroup(groupName, toolNames) {
    this.groups.set(groupName, new Set(toolNames));
  }

  /**
   * Get group tools
   */
  getGroup(groupName) {
    const group = this.groups.get(groupName);
    return group ? Array.from(group) : [];
  }

  /**
   * Get all groups
   */
  getAllGroups() {
    const result = {};
    for (const [name, tools] of this.groups) {
      result[name] = Array.from(tools);
    }
    return result;
  }

  /**
   * Suggest related tools
   */
  getSuggestedTools(toolName) {
    const tool = this.tools.get(toolName);
    if (!tool) return [];

    const metadata = this.metadata.get(toolName);
    if (!metadata) return [];

    const suggestions = [];
    
    // Find tools with similar tags
    if (metadata.tags) {
      for (const tag of metadata.tags) {
        const taggedTools = this.getToolsByTags([tag]);
        for (const taggedTool of taggedTools) {
          if (taggedTool.name !== toolName) {
            suggestions.push({
              name: taggedTool.name,
              reason: `shares tag: ${tag}`,
              score: 0.8
            });
          }
        }
      }
    }

    // Find tools in same category
    if (metadata.category) {
      const categoryTools = this.getToolsByCategory(metadata.category);
      for (const categoryTool of categoryTools) {
        if (categoryTool.name !== toolName) {
          suggestions.push({
            name: categoryTool.name,
            reason: `same category: ${metadata.category}`,
            score: 0.6
          });
        }
      }
    }

    // Remove duplicates and sort by score
    const uniqueSuggestions = suggestions.filter((suggestion, index) => 
      suggestions.findIndex(s => s.name === suggestion.name) === index
    );

    return uniqueSuggestions.sort((a, b) => b.score - a.score);
  }

  /**
   * Record tool usage
   */
  recordUsage(toolName) {
    if (!this.usage.has(toolName)) {
      this.usage.set(toolName, { count: 0, lastUsed: null });
    }

    const usage = this.usage.get(toolName);
    usage.count++;
    usage.lastUsed = new Date();
  }

  /**
   * Get tool usage statistics
   */
  getToolUsage(toolName) {
    return this.usage.get(toolName) || { count: 0, lastUsed: null };
  }

  /**
   * Get overall usage statistics
   */
  getUsageStatistics() {
    const allUsage = Array.from(this.usage.entries());
    const totalUsage = allUsage.reduce((sum, [, usage]) => sum + usage.count, 0);
    
    const mostUsed = allUsage
      .map(([tool, usage]) => ({ tool, count: usage.count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalUsage,
      mostUsed
    };
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const categoryCounts = {};
    for (const [category, tools] of this.categoryIndex) {
      categoryCounts[category] = tools.length;
    }

    const usageStats = this.getUsageStatistics();

    return {
      totalTools: this.tools.size,
      categoryCounts,
      totalUsage: usageStats.totalUsage,
      totalCategories: this.categoryIndex.size,
      totalTags: this.tagIndex.size
    };
  }

  /**
   * Unregister tool
   */
  unregisterTool(toolName) {
    if (!this.tools.has(toolName)) {
      return false;
    }

    // Remove from main storage
    this.tools.delete(toolName);
    this.metadata.delete(toolName);
    this.usage.delete(toolName);

    // Remove from indexes
    this._removeFromIndexes(toolName);

    // Remove relationships
    this.dependencies.delete(toolName);
    this.dependents.delete(toolName);

    // Remove from groups
    for (const [groupName, tools] of this.groups) {
      tools.delete(toolName);
    }

    return true;
  }

  /**
   * Clear all tools
   */
  clear() {
    this.tools.clear();
    this.metadata.clear();
    this.usage.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
    this.dependencies.clear();
    this.dependents.clear();
    this.groups.clear();
  }

  /**
   * Clone registry
   */
  clone() {
    const cloned = new ToolRegistry(this.options);
    
    // Copy tools and metadata
    for (const [name, tool] of this.tools) {
      cloned.registerTool({ ...tool });
    }

    // Copy usage stats
    for (const [name, usage] of this.usage) {
      cloned.usage.set(name, { ...usage });
    }

    return cloned;
  }

  /**
   * Merge another registry into this one
   */
  merge(otherRegistry) {
    for (const [name, tool] of otherRegistry.tools) {
      this.registerTool({ ...tool });
    }
  }

  /**
   * Check tool compatibility
   */
  checkCompatibility(tool) {
    const issues = [];

    if (!tool.name) {
      issues.push('Tool must have a name');
    }

    if (!tool.execute) {
      issues.push('Tool must have an execute function');
    }

    if (this.options.validateNames && tool.name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
        issues.push('Tool name must contain only letters, numbers, hyphens, and underscores');
      }
    }

    if (this.options.allowedCategories && tool.category) {
      if (!this.options.allowedCategories.includes(tool.category)) {
        issues.push(`Invalid category: ${tool.category}`);
      }
    }

    return {
      compatible: issues.length === 0,
      issues
    };
  }

  /**
   * Export registry data
   */
  export() {
    return {
      tools: Array.from(this.tools.values()),
      metadata: Object.fromEntries(this.metadata),
      usage: Object.fromEntries(this.usage),
      groups: Object.fromEntries(this.groups.entries()),
      exportedAt: new Date()
    };
  }

  /**
   * Import registry data
   */
  import(data) {
    this.clear();

    if (data.tools) {
      for (const tool of data.tools) {
        this.registerTool(tool);
      }
    }

    if (data.metadata) {
      for (const [name, metadata] of Object.entries(data.metadata)) {
        if (this.tools.has(name)) {
          this.metadata.set(name, metadata);
        }
      }
    }

    if (data.usage) {
      for (const [name, usage] of Object.entries(data.usage)) {
        if (this.tools.has(name)) {
          this.usage.set(name, usage);
        }
      }
    }
  }

  /**
   * Validate tool structure
   * @private
   */
  _validateTool(tool) {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool must be an object');
    }

    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    const compatibility = this.checkCompatibility(tool);
    if (!compatibility.compatible) {
      throw new Error(compatibility.issues[0]);
    }
  }

  /**
   * Generate metadata for a tool
   * @private
   */
  _generateMetadata(tool) {
    // Extract semantic metadata for better discovery
    const semanticMetadata = this._extractSemanticMetadata(tool);
    
    return {
      name: tool.name,
      description: tool.description || '',
      category: tool.category || this._inferCategory(tool),
      tags: tool.tags || this._generateTags(tool),
      author: tool.author || null,
      version: tool.version || null,
      registeredAt: new Date(),
      // Semantic search fields
      capabilities: semanticMetadata.capabilities,
      inputTypes: semanticMetadata.inputTypes,
      outputTypes: semanticMetadata.outputTypes,
      usageExamples: tool.examples || [],
      relatedConcepts: semanticMetadata.relatedConcepts,
      ...tool.metadata
    };
  }

  /**
   * Extract semantic metadata from tool for better search
   * @private
   */
  _extractSemanticMetadata(tool) {
    const metadata = {
      capabilities: [],
      inputTypes: [],
      outputTypes: [],
      relatedConcepts: []
    };

    // Extract capabilities from name and description
    const text = `${tool.name} ${tool.description || ''}`.toLowerCase();
    
    // Capability patterns
    const capabilityPatterns = {
      'create': ['creation', 'generation', 'initialization'],
      'read': ['reading', 'fetching', 'retrieval'],
      'update': ['modification', 'editing', 'changing'],
      'delete': ['removal', 'deletion', 'cleanup'],
      'validate': ['validation', 'verification', 'checking'],
      'transform': ['transformation', 'conversion', 'processing'],
      'analyze': ['analysis', 'inspection', 'examination'],
      'execute': ['execution', 'running', 'invocation'],
      'deploy': ['deployment', 'release', 'publishing'],
      'test': ['testing', 'assertion', 'verification'],
      'debug': ['debugging', 'troubleshooting', 'diagnosis'],
      'monitor': ['monitoring', 'observability', 'tracking'],
      'optimize': ['optimization', 'improvement', 'enhancement']
    };

    for (const [key, values] of Object.entries(capabilityPatterns)) {
      if (text.includes(key)) {
        metadata.capabilities.push(...values);
      }
    }

    // Extract input/output types from schema
    if (tool.inputSchema || tool.schema) {
      metadata.inputTypes = this._extractSchemaTypes(tool.inputSchema || tool.schema);
    }
    if (tool.outputSchema) {
      metadata.outputTypes = this._extractSchemaTypes(tool.outputSchema);
    }

    // Extract related concepts
    const conceptPatterns = {
      'file': ['filesystem', 'directory', 'path'],
      'api': ['REST', 'HTTP', 'endpoint'],
      'database': ['SQL', 'query', 'schema'],
      'cloud': ['AWS', 'Azure', 'GCP', 'deployment'],
      'container': ['Docker', 'Kubernetes', 'containerization'],
      'frontend': ['React', 'Vue', 'UI', 'component'],
      'backend': ['server', 'Node.js', 'Express'],
      'data': ['processing', 'transformation', 'pipeline'],
      'security': ['authentication', 'authorization', 'encryption'],
      'performance': ['optimization', 'caching', 'scaling']
    };

    for (const [key, concepts] of Object.entries(conceptPatterns)) {
      if (text.includes(key)) {
        metadata.relatedConcepts.push(...concepts);
      }
    }

    return metadata;
  }

  /**
   * Extract types from schema for semantic search
   * @private
   */
  _extractSchemaTypes(schema) {
    const types = [];
    
    if (!schema) return types;

    // Handle Zod schemas
    if (schema._def) {
      if (schema._def.typeName) {
        types.push(schema._def.typeName.replace('Zod', '').toLowerCase());
      }
      if (schema._def.shape) {
        const shape = schema._def.shape();
        types.push(...Object.keys(shape));
      }
    }

    // Handle JSON schemas
    if (schema.type) {
      types.push(schema.type);
    }
    if (schema.properties) {
      types.push(...Object.keys(schema.properties));
    }

    // Handle OpenAI function schemas
    if (schema.parameters) {
      return this._extractSchemaTypes(schema.parameters);
    }

    return types;
  }

  /**
   * Infer category from tool name and description
   * @private
   */
  _inferCategory(tool) {
    const text = `${tool.name} ${tool.description || ''}`.toLowerCase();
    
    const categoryPatterns = {
      'file': /file|directory|folder|path|fs/,
      'api': /api|rest|http|endpoint|request/,
      'database': /database|db|sql|query|mongo/,
      'testing': /test|spec|assert|verify|mock/,
      'deployment': /deploy|release|publish|ci|cd/,
      'development': /build|compile|transpile|bundle/,
      'security': /auth|encrypt|secure|permission/,
      'monitoring': /monitor|log|trace|metric|observe/,
      'data': /data|transform|process|parse|convert/,
      'ai': /ai|ml|llm|embedding|neural|model/
    };

    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(text)) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Generate tags from tool properties
   * @private
   */
  _generateTags(tool) {
    const tags = new Set();
    const text = `${tool.name} ${tool.description || ''}`.toLowerCase();

    // Technology tags
    const techPatterns = {
      'javascript': /javascript|js|node/,
      'typescript': /typescript|ts/,
      'python': /python|py/,
      'react': /react/,
      'vue': /vue/,
      'docker': /docker|container/,
      'kubernetes': /kubernetes|k8s/,
      'aws': /aws|amazon/,
      'git': /git|github|gitlab/,
      'npm': /npm|package/,
      'json': /json/,
      'yaml': /yaml|yml/,
      'markdown': /markdown|md/,
      'html': /html/,
      'css': /css|style/
    };

    for (const [tag, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(text)) {
        tags.add(tag);
      }
    }

    // Action tags
    if (/create|new|generate/.test(text)) tags.add('create');
    if (/read|get|fetch/.test(text)) tags.add('read');
    if (/update|edit|modify/.test(text)) tags.add('update');
    if (/delete|remove/.test(text)) tags.add('delete');
    if (/async|promise|await/.test(text)) tags.add('async');
    if (/sync/.test(text) && !/async/.test(text)) tags.add('sync');

    return Array.from(tags);
  }

  /**
   * Update search indexes
   * @private
   */
  _updateIndexes(toolName, metadata) {
    // Update category index
    if (metadata.category) {
      if (!this.categoryIndex.has(metadata.category)) {
        this.categoryIndex.set(metadata.category, []);
      }
      const categoryTools = this.categoryIndex.get(metadata.category);
      if (!categoryTools.includes(toolName)) {
        categoryTools.push(toolName);
      }
    }

    // Update tag index
    if (metadata.tags) {
      for (const tag of metadata.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, []);
        }
        const tagTools = this.tagIndex.get(tag);
        if (!tagTools.includes(toolName)) {
          tagTools.push(toolName);
        }
      }
    }
  }

  /**
   * Remove tool from indexes
   * @private
   */
  _removeFromIndexes(toolName) {
    // Remove from category index
    for (const [category, tools] of this.categoryIndex) {
      const index = tools.indexOf(toolName);
      if (index !== -1) {
        tools.splice(index, 1);
      }
      if (tools.length === 0) {
        this.categoryIndex.delete(category);
      }
    }

    // Remove from tag index
    for (const [tag, tools] of this.tagIndex) {
      const index = tools.indexOf(toolName);
      if (index !== -1) {
        tools.splice(index, 1);
      }
      if (tools.length === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }

  /**
   * Check for circular dependencies
   * @private
   */
  _wouldCreateCircularDependency(toolA, toolB) {
    const visited = new Set();
    
    const checkDependencies = (tool) => {
      if (visited.has(tool)) {
        return true; // Circular dependency found
      }
      
      visited.add(tool);
      const deps = this.dependencies.get(tool);
      
      if (deps) {
        for (const dep of deps) {
          if (dep === toolA || checkDependencies(dep)) {
            return true;
          }
        }
      }
      
      visited.delete(tool);
      return false;
    };

    return checkDependencies(toolB);
  }

  /**
   * Calculate fuzzy match score
   * @private
   */
  _calculateFuzzyScore(text, query) {
    if (text.includes(query)) {
      return 1.0; // Exact substring match
    }

    // Simple character-based scoring
    let score = 0;
    let textIndex = 0;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const foundIndex = text.indexOf(char, textIndex);
      
      if (foundIndex !== -1) {
        score += 1 / (foundIndex - textIndex + 1);
        textIndex = foundIndex + 1;
      }
    }

    return score / query.length;
  }
}