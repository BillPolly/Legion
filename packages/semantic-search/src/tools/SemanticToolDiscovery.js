/**
 * SemanticToolDiscovery - Intelligent tool discovery service for LLM planning
 * 
 * This service helps LLM agents find the most relevant tools for their tasks
 * by performing semantic search and intelligent ranking based on task descriptions.
 * Enhanced with MCP server integration for automatic tool discovery and suggestions.
 */

import { ToolIndexer } from './ToolIndexer.js';

export class SemanticToolDiscovery {
  constructor(dependencies = {}) {
    this.semanticSearchProvider = dependencies.semanticSearchProvider;
    this.toolIndexer = dependencies.toolIndexer || new ToolIndexer(dependencies);
    this.toolRegistry = dependencies.toolRegistry;
    this.collectionName = dependencies.collectionName || 'legion_tools';
    
    // MCP Integration
    this.mcpServerRegistry = dependencies.mcpServerRegistry;
    this.mcpPackageManager = dependencies.mcpPackageManager;
    this.enableMCPIntegration = dependencies.enableMCPIntegration !== false;
    this.mcpCollectionName = dependencies.mcpCollectionName || 'mcp_tools';
    
    // Discovery configuration
    this.config = {
      defaultLimit: 20,
      minRelevanceScore: 0.7,
      includeRelatedTools: true,
      includeDependencies: true,
      boostFrequentlyUsedTogether: true,
      
      // MCP-specific configuration
      includeMCPTools: this.enableMCPIntegration,
      mcpSearchWeight: 0.8, // Weight for MCP tools in combined results
      mcpAutoSuggest: true, // Suggest installable MCP servers
      maxMCPSuggestions: 3,
      ...dependencies.config
    };

    // Cache for frequently requested queries
    this.queryCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // MCP-specific cache
    this.mcpQueryCache = new Map();
    this.mcpRecommendationCache = new Map();
  }

  /**
   * Find relevant tools for a given task description
   * Enhanced with MCP integration for comprehensive tool discovery
   * @param {string} taskDescription - Natural language description of the task
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Array of relevant tools with scores and installation suggestions
   */
  async findRelevantTools(taskDescription, options = {}) {
    const {
      limit = this.config.defaultLimit,
      minScore = this.config.minRelevanceScore,
      categories = null,
      excludeTools = [],
      includeMetadata = true,
      useCache = true,
      includeMCPTools = this.config.includeMCPTools,
      includeSuggestions = this.config.mcpAutoSuggest
    } = options;

    // Check cache
    const cacheKey = this.getCacheKey(taskDescription, options);
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }
    }

    // Enhance task description for better semantic matching
    const enhancedQuery = this.enhanceTaskDescription(taskDescription);

    // Search Legion tools
    const legionSearchResults = await this.semanticSearchProvider.semanticSearch(
      this.collectionName,
      enhancedQuery,
      {
        limit: limit * 2, // Get more for filtering
        threshold: minScore,
        includeMetadata,
        filter: this.buildSearchFilter(categories, excludeTools)
      }
    );

    // Process Legion tools
    let relevantTools = this.processSearchResults(legionSearchResults, taskDescription);

    // Search MCP tools if enabled
    let mcpTools = [];
    let installableSuggestions = [];
    
    if (includeMCPTools && this.enableMCPIntegration) {
      const mcpResults = await this.searchMCPTools(taskDescription, {
        limit: Math.ceil(limit / 2),
        minScore,
        categories,
        excludeTools
      });
      
      mcpTools = mcpResults.availableTools;
      installableSuggestions = mcpResults.installableSuggestions;
    }

    // Combine and deduplicate results
    relevantTools = this.combineToolResults(relevantTools, mcpTools, taskDescription);

    // Add related tools if configured
    if (this.config.includeRelatedTools) {
      relevantTools = await this.includeRelatedTools(relevantTools, limit);
    }

    // Add dependencies if configured
    if (this.config.includeDependencies) {
      relevantTools = await this.includeDependencies(relevantTools);
    }

    // Apply intelligent ranking
    relevantTools = this.rankTools(relevantTools, taskDescription);

    // Limit to requested number
    relevantTools = relevantTools.slice(0, limit);

    // Add tool instances if registry is available
    if (this.toolRegistry) {
      relevantTools = await this.enrichWithToolInstances(relevantTools);
    }

    // Prepare final result with suggestions
    const result = {
      tools: relevantTools,
      suggestions: includeSuggestions ? installableSuggestions : [],
      metadata: {
        totalFound: relevantTools.length,
        legionTools: relevantTools.filter(t => t.source !== 'mcp').length,
        mcpTools: relevantTools.filter(t => t.source === 'mcp').length,
        installableSuggestions: installableSuggestions.length,
        searchQuery: enhancedQuery
      }
    };

    // Cache results
    if (useCache) {
      this.queryCache.set(cacheKey, {
        results: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Find tools similar to a given tool
   * @param {string} toolName - Reference tool name
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Similar tools
   */
  async findSimilarTools(toolName, options = {}) {
    const {
      limit = 10,
      excludeSelf = true
    } = options;

    // Get the tool document
    const toolDoc = await this.getToolDocument(toolName);
    if (!toolDoc) {
      throw new Error(`Tool ${toolName} not found in index`);
    }

    // Find similar tools
    const similar = await this.semanticSearchProvider.findSimilar(
      this.collectionName,
      toolDoc,
      { 
        limit: excludeSelf ? limit + 1 : limit,
        threshold: 0.6
      }
    );

    // Filter out self if needed
    let results = similar;
    if (excludeSelf) {
      results = similar.filter(r => r.document?.name !== toolName);
    }

    return results.slice(0, limit);
  }

  /**
   * Find tool combinations for complex tasks
   * @param {string} taskDescription - Task description
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Tool combinations with workflow suggestions
   */
  async findToolCombinations(taskDescription, options = {}) {
    const {
      maxTools = 10,
      suggestWorkflow = true
    } = options;

    // Get initial relevant tools
    const relevantTools = await this.findRelevantTools(taskDescription, {
      limit: maxTools * 2
    });

    // Analyze task for subtasks
    const subtasks = this.analyzeTaskForSubtasks(taskDescription);

    // Find tools for each subtask
    const toolCombinations = {
      primaryTools: [],
      supportingTools: [],
      subtaskTools: {},
      suggestedWorkflow: null
    };

    // Categorize tools by their role
    for (const tool of relevantTools) {
      if (tool.relevanceScore > 0.85) {
        toolCombinations.primaryTools.push(tool);
      } else if (tool.relevanceScore > 0.7) {
        toolCombinations.supportingTools.push(tool);
      }
    }

    // Find tools for each subtask
    for (const subtask of subtasks) {
      const subtaskTools = await this.findRelevantTools(subtask.description, {
        limit: 5
      });
      toolCombinations.subtaskTools[subtask.name] = subtaskTools;
    }

    // Generate workflow suggestion if requested
    if (suggestWorkflow) {
      toolCombinations.suggestedWorkflow = this.generateWorkflowSuggestion(
        taskDescription,
        toolCombinations,
        subtasks
      );
    }

    return toolCombinations;
  }

  /**
   * Get tool recommendations based on usage patterns
   * Enhanced with MCP server suggestions
   * @param {Array} recentlyUsedTools - Tools used recently
   * @param {string} context - Current context/task
   * @returns {Promise<Array>} Recommended tools with installation suggestions
   */
  async getToolRecommendations(recentlyUsedTools, context = '') {
    const recommendations = new Map();

    // Analyze recent tools for patterns
    for (const toolName of recentlyUsedTools) {
      const toolDoc = await this.getToolDocument(toolName);
      if (!toolDoc) continue;

      // Add commonly used together tools
      if (toolDoc.commonlyUsedWith) {
        for (const relatedTool of toolDoc.commonlyUsedWith) {
          if (!recentlyUsedTools.includes(relatedTool)) {
            const score = recommendations.get(relatedTool) || 0;
            recommendations.set(relatedTool, score + 0.3);
          }
        }
      }

      // Add related tools
      if (toolDoc.relatedTools) {
        for (const relatedTool of toolDoc.relatedTools) {
          if (!recentlyUsedTools.includes(relatedTool)) {
            const score = recommendations.get(relatedTool) || 0;
            recommendations.set(relatedTool, score + 0.2);
          }
        }
      }
    }

    // If context provided, find contextually relevant tools
    if (context) {
      const contextResults = await this.findRelevantTools(context, {
        limit: 10,
        excludeTools: recentlyUsedTools
      });

      // Handle both old format (array) and new format (object)
      const contextTools = contextResults.tools || contextResults;
      
      for (const tool of contextTools) {
        const currentScore = recommendations.get(tool.name) || 0;
        recommendations.set(tool.name, currentScore + tool.relevanceScore * 0.5);
      }
    }

    // Convert to array and sort by score
    const recommendedTools = Array.from(recommendations.entries())
      .map(([name, score]) => ({ name, recommendationScore: score }))
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Enrich with tool information
    const enrichedTools = await this.enrichWithToolInstances(recommendedTools.slice(0, 10));
    
    // Get MCP suggestions if context is provided
    let mcpSuggestions = [];
    if (context && this.enableMCPIntegration && this.mcpPackageManager) {
      mcpSuggestions = await this.getMCPServerSuggestions(context, {
        limit: this.config.maxMCPSuggestions
      });
    }
    
    return {
      tools: enrichedTools,
      mcpSuggestions,
      context
    };
  }

  /**
   * Search MCP tools and get installation suggestions
   * @param {string} taskDescription - Task description
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Available tools and installable suggestions
   */
  async searchMCPTools(taskDescription, options = {}) {
    if (!this.enableMCPIntegration || !this.mcpServerRegistry) {
      return { availableTools: [], installableSuggestions: [] };
    }
    
    const cacheKey = `mcp:${taskDescription}:${JSON.stringify(options)}`;
    
    // Check MCP cache
    if (this.mcpQueryCache.has(cacheKey)) {
      const cached = this.mcpQueryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }
    }
    
    try {
      // Search available MCP tools
      const availableTools = await this.mcpServerRegistry.searchMCPTools(taskDescription, {
        limit: options.limit || 10,
        categories: options.categories,
        minRelevance: options.minScore || 0.6
      });
      
      // Get installable server suggestions if we have few results
      let installableSuggestions = [];
      if (availableTools.length < 3 && this.mcpPackageManager) {
        installableSuggestions = await this.mcpPackageManager.getRecommendations(taskDescription, {
          maxRecommendations: this.config.maxMCPSuggestions,
          includeInstalled: false
        });
      }
      
      const results = {
        availableTools: availableTools.map(tool => ({
          ...tool,
          source: 'mcp',
          available: true,
          installationRequired: false
        })),
        installableSuggestions: installableSuggestions.map(suggestion => ({
          ...suggestion,
          source: 'mcp',
          available: false,
          installationRequired: true,
          installCommand: `npm install ${suggestion.packageName || suggestion.name}`
        }))
      };
      
      // Cache results
      this.mcpQueryCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });
      
      return results;
      
    } catch (error) {
      console.warn('MCP tool search failed:', error.message);
      return { availableTools: [], installableSuggestions: [] };
    }
  }

  /**
   * Combine Legion and MCP tool results intelligently
   * @param {Array} legionTools - Legion tools
   * @param {Array} mcpTools - MCP tools  
   * @param {string} taskDescription - Original task description
   * @returns {Array} Combined and ranked results
   */
  combineToolResults(legionTools, mcpTools, taskDescription) {
    // Create a map to handle duplicates
    const combinedMap = new Map();
    
    // Add Legion tools (higher priority)
    for (const tool of legionTools) {
      combinedMap.set(tool.name, {
        ...tool,
        source: tool.source || 'legion',
        priority: 1.0
      });
    }
    
    // Add MCP tools (slightly lower priority to avoid duplicates)
    for (const tool of mcpTools) {
      const key = tool.name;
      
      // Skip if we already have a similar tool
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          ...tool,
          source: 'mcp',
          priority: this.config.mcpSearchWeight,
          relevanceScore: (tool.relevanceScore || 0) * this.config.mcpSearchWeight
        });
      }
    }
    
    // Convert back to array and sort by combined score
    return Array.from(combinedMap.values())
      .sort((a, b) => {
        const scoreA = (a.relevanceScore || 0) * a.priority;
        const scoreB = (b.relevanceScore || 0) * b.priority;
        return scoreB - scoreA;
      });
  }

  /**
   * Get MCP server installation suggestions for a task
   * @param {string} taskDescription - Task description
   * @param {Object} options - Options
   * @returns {Promise<Array>} Server suggestions
   */
  async getMCPServerSuggestions(taskDescription, options = {}) {
    if (!this.mcpPackageManager) return [];
    
    const cacheKey = `mcp-suggestions:${taskDescription}`;
    
    // Check cache
    if (this.mcpRecommendationCache.has(cacheKey)) {
      const cached = this.mcpRecommendationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }
    }
    
    try {
      const suggestions = await this.mcpPackageManager.getRecommendations(taskDescription, {
        maxRecommendations: options.limit || 3,
        includeInstalled: false
      });
      
      const formattedSuggestions = suggestions.map(suggestion => ({
        type: 'install-mcp-server',
        message: `Install ${suggestion.name} for ${taskDescription}`,
        serverId: suggestion.id,
        serverName: suggestion.name,
        description: suggestion.description,
        toolCount: suggestion.toolCount || 0,
        category: suggestion.category,
        installCommand: `npm install ${suggestion.packageName || suggestion.name}`,
        relevanceScore: suggestion.relevanceScore || 0.5
      }));
      
      // Cache results
      this.mcpRecommendationCache.set(cacheKey, {
        results: formattedSuggestions,
        timestamp: Date.now()
      });
      
      return formattedSuggestions;
      
    } catch (error) {
      console.warn('Failed to get MCP server suggestions:', error.message);
      return [];
    }
  }

  /**
   * Enhance task description for better semantic matching
   * @private
   */
  enhanceTaskDescription(taskDescription) {
    const enhancements = [];
    enhancements.push(taskDescription);

    // Add common synonyms and related terms
    const taskLower = taskDescription.toLowerCase();

    // Development task patterns
    if (taskLower.includes('build') || taskLower.includes('create')) {
      enhancements.push('develop construct implement generate');
    }
    if (taskLower.includes('test')) {
      enhancements.push('verify validate check assert debug');
    }
    if (taskLower.includes('deploy')) {
      enhancements.push('release publish distribute launch');
    }
    if (taskLower.includes('analyze')) {
      enhancements.push('examine investigate inspect evaluate');
    }

    // Technology-specific patterns
    if (taskLower.includes('api')) {
      enhancements.push('REST endpoint service HTTP request response');
    }
    if (taskLower.includes('database') || taskLower.includes('db')) {
      enhancements.push('SQL query table schema migration data storage');
    }
    if (taskLower.includes('frontend') || taskLower.includes('ui')) {
      enhancements.push('React component HTML CSS JavaScript interface');
    }
    if (taskLower.includes('backend')) {
      enhancements.push('server Node Express API middleware service');
    }

    return enhancements.join(' ');
  }

  /**
   * Process search results and add relevance metadata
   * @private
   */
  processSearchResults(searchResults, originalTask) {
    // Group results by tool name to handle multiple perspectives
    const toolGroups = new Map();
    
    searchResults.forEach(result => {
      const tool = result.document || result.payload;
      const toolName = tool.name;
      
      if (!toolGroups.has(toolName)) {
        toolGroups.set(toolName, []);
      }
      
      toolGroups.get(toolName).push({
        result,
        tool,
        perspectiveType: tool.perspectiveType || 'default',
        similarity: result._similarity || result.score || 0
      });
    });
    
    // Process each tool group and take the best score
    const processedTools = [];
    
    for (const [toolName, perspectives] of toolGroups) {
      // Sort perspectives by similarity score
      perspectives.sort((a, b) => b.similarity - a.similarity);
      
      // Use the highest scoring perspective
      const best = perspectives[0];
      const tool = best.tool;
      
      // Calculate additional relevance factors
      const nameRelevance = this.calculateNameRelevance(tool.name, originalTask);
      const categoryRelevance = this.calculateCategoryRelevance(tool.category, originalTask);
      const capabilityRelevance = this.calculateCapabilityRelevance(tool.capabilities, originalTask);
      
      // Boost score if multiple perspectives matched
      const perspectiveBoost = Math.min(perspectives.length * 0.05, 0.2);
      
      // Combine scores with perspective boost
      const combinedScore = Math.min(
        best.similarity * 0.5 +
        nameRelevance * 0.2 +
        categoryRelevance * 0.15 +
        capabilityRelevance * 0.15 +
        perspectiveBoost,
        1.0
      );
      
      processedTools.push({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        tags: tool.tags,
        capabilities: tool.capabilities,
        relevanceScore: combinedScore,
        similarityScore: best.similarity,
        nameRelevance,
        categoryRelevance,
        capabilityRelevance,
        perspectiveMatches: perspectives.length,
        bestPerspective: best.perspectiveType,
        metadata: tool
      });
    }
    
    // Sort by relevance score
    processedTools.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return processedTools;
  }

  /**
   * Calculate name relevance score
   * @private
   */
  calculateNameRelevance(toolName, task) {
    const nameLower = toolName.toLowerCase();
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(/\s+/);

    let score = 0;
    for (const word of taskWords) {
      if (nameLower.includes(word)) {
        score += 0.5;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate category relevance score
   * @private
   */
  calculateCategoryRelevance(category, task) {
    const categoryMap = {
      'file': ['file', 'directory', 'folder', 'path'],
      'api': ['api', 'endpoint', 'request', 'http'],
      'database': ['database', 'db', 'sql', 'query'],
      'testing': ['test', 'verify', 'validate', 'check'],
      'deployment': ['deploy', 'release', 'publish'],
      'development': ['build', 'create', 'develop', 'code']
    };

    const taskLower = task.toLowerCase();
    const categoryKeywords = categoryMap[category.toLowerCase()] || [];

    for (const keyword of categoryKeywords) {
      if (taskLower.includes(keyword)) {
        return 0.8;
      }
    }

    return 0.2;
  }

  /**
   * Calculate capability relevance score
   * @private
   */
  calculateCapabilityRelevance(capabilities, task) {
    if (!capabilities || capabilities.length === 0) {
      return 0;
    }

    const taskLower = task.toLowerCase();
    let matchCount = 0;

    for (const capability of capabilities) {
      const capWords = capability.toLowerCase().split(/\s+/);
      for (const word of capWords) {
        if (taskLower.includes(word)) {
          matchCount++;
        }
      }
    }

    return Math.min(matchCount * 0.2, 1.0);
  }

  /**
   * Include related tools based on relationships
   * @private
   */
  async includeRelatedTools(tools, limit) {
    const allTools = new Map();
    
    // Add primary tools
    for (const tool of tools) {
      allTools.set(tool.name, tool);
    }

    // Add related tools
    for (const tool of tools) {
      if (tool.metadata?.relatedTools) {
        for (const relatedName of tool.metadata.relatedTools) {
          if (!allTools.has(relatedName) && allTools.size < limit) {
            const relatedDoc = await this.getToolDocument(relatedName);
            if (relatedDoc) {
              allTools.set(relatedName, {
                ...relatedDoc,
                relevanceScore: tool.relevanceScore * 0.7,
                relationship: 'related',
                relatedTo: tool.name
              });
            }
          }
        }
      }
    }

    return Array.from(allTools.values());
  }

  /**
   * Include tool dependencies
   * @private
   */
  async includeDependencies(tools) {
    const allTools = new Map();
    
    // Add primary tools
    for (const tool of tools) {
      allTools.set(tool.name, tool);
    }

    // Add dependencies
    for (const tool of tools) {
      if (tool.metadata?.dependencies) {
        for (const depName of tool.metadata.dependencies) {
          if (!allTools.has(depName)) {
            const depDoc = await this.getToolDocument(depName);
            if (depDoc) {
              allTools.set(depName, {
                ...depDoc,
                relevanceScore: Math.max(tool.relevanceScore * 0.8, 0.7),
                relationship: 'dependency',
                requiredBy: tool.name
              });
            }
          }
        }
      }
    }

    return Array.from(allTools.values());
  }

  /**
   * Rank tools using multiple factors
   * @private
   */
  rankTools(tools, taskDescription) {
    // Sort by relevance score
    tools.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Boost tools that work well together
    if (this.config.boostFrequentlyUsedTogether) {
      const toolNames = new Set(tools.map(t => t.name));
      
      for (const tool of tools) {
        if (tool.metadata?.commonlyUsedWith) {
          const cooccurrenceBoost = tool.metadata.commonlyUsedWith
            .filter(name => toolNames.has(name))
            .length * 0.05;
          
          tool.relevanceScore = Math.min(
            tool.relevanceScore + cooccurrenceBoost,
            1.0
          );
        }
      }

      // Re-sort after boosting
      tools.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return tools;
  }

  /**
   * Analyze task for subtasks
   * @private
   */
  analyzeTaskForSubtasks(taskDescription) {
    const subtasks = [];
    const taskLower = taskDescription.toLowerCase();

    // Common task patterns
    const patterns = [
      { pattern: /create|build|develop/i, name: 'creation', description: 'Create or build components' },
      { pattern: /test|verify|validate/i, name: 'testing', description: 'Test and validate functionality' },
      { pattern: /deploy|release|publish/i, name: 'deployment', description: 'Deploy or release' },
      { pattern: /analyze|examine|investigate/i, name: 'analysis', description: 'Analyze data or code' },
      { pattern: /fix|repair|debug/i, name: 'debugging', description: 'Fix issues or debug' },
      { pattern: /optimize|improve|enhance/i, name: 'optimization', description: 'Optimize performance' },
      { pattern: /document|describe|explain/i, name: 'documentation', description: 'Create documentation' },
      { pattern: /integrate|connect|link/i, name: 'integration', description: 'Integrate systems' }
    ];

    for (const { pattern, name, description } of patterns) {
      if (pattern.test(taskDescription)) {
        subtasks.push({ name, description });
      }
    }

    return subtasks;
  }

  /**
   * Generate workflow suggestion
   * @private
   */
  generateWorkflowSuggestion(taskDescription, toolCombinations, subtasks) {
    const workflow = {
      description: taskDescription,
      phases: [],
      estimatedTools: 0
    };

    // Create phases based on subtasks
    for (const subtask of subtasks) {
      const phase = {
        name: subtask.name,
        description: subtask.description,
        tools: []
      };

      // Add relevant tools for this phase
      const subtaskTools = toolCombinations.subtaskTools[subtask.name] || [];
      phase.tools = subtaskTools.slice(0, 3).map(t => t.name);

      workflow.phases.push(phase);
      workflow.estimatedTools += phase.tools.length;
    }

    // Add primary tools if no phases
    if (workflow.phases.length === 0 && toolCombinations.primaryTools.length > 0) {
      workflow.phases.push({
        name: 'main',
        description: 'Main task execution',
        tools: toolCombinations.primaryTools.slice(0, 5).map(t => t.name)
      });
      workflow.estimatedTools = workflow.phases[0].tools.length;
    }

    return workflow;
  }

  /**
   * Enrich results with actual tool instances
   * @private
   */
  async enrichWithToolInstances(tools) {
    if (!this.toolRegistry) {
      return tools;
    }

    return tools.map(toolInfo => {
      const toolInstance = this.toolRegistry.getTool(toolInfo.name);
      if (toolInstance) {
        return {
          ...toolInfo,
          instance: toolInstance,
          available: true
        };
      }
      return {
        ...toolInfo,
        available: false
      };
    });
  }

  /**
   * Get tool document from index
   * @private
   */
  async getToolDocument(toolName) {
    try {
      // First try to get from toolIndexer's cache
      const indexed = this.toolIndexer.indexedTools.get(toolName);
      if (indexed && indexed.document) {
        return indexed.document;
      }
      
      // For multi-perspective indexing, search for the tool's name perspective
      const searchResults = await this.semanticSearchProvider.semanticSearch(
        this.collectionName,
        toolName,  // Just search for the tool name directly
        { limit: 20, threshold: 0.3 }  // Lower threshold since we're looking for exact tool
      );
      
      // Find exact match by name, considering multiple perspectives
      for (const result of searchResults) {
        const doc = result.document || result.payload;
        if (doc && doc.name === toolName) {
          // Remove perspective-specific fields to get clean document
          const cleanDoc = { ...doc };
          delete cleanDoc.perspectiveType;
          delete cleanDoc.perspectiveText;
          return cleanDoc;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get tool document for ${toolName}:`, error);
      return null;
    }
  }

  /**
   * Build search filter
   * @private
   */
  buildSearchFilter(categories, excludeTools) {
    const filter = {};

    if (categories && categories.length > 0) {
      filter.category = { $in: categories };
    }

    if (excludeTools && excludeTools.length > 0) {
      filter.name = { $nin: excludeTools };
    }

    return filter;
  }

  /**
   * Get cache key for query
   * @private
   */
  getCacheKey(query, options) {
    return `${query}_${JSON.stringify(options)}`;
  }

  /**
   * Clear query cache (including MCP caches)
   */
  clearCache(cacheType = 'all') {
    switch (cacheType) {
      case 'all':
        this.queryCache.clear();
        this.mcpQueryCache.clear();
        this.mcpRecommendationCache.clear();
        break;
      case 'legion':
        this.queryCache.clear();
        break;
      case 'mcp':
        this.mcpQueryCache.clear();
        this.mcpRecommendationCache.clear();
        break;
      default:
        this.queryCache.clear();
    }
  }

  /**
   * Get discovery statistics (including MCP integration stats)
   */
  getStatistics() {
    return {
      cacheSize: this.queryCache.size,
      mcpCacheSize: this.mcpQueryCache.size,
      mcpRecommendationCacheSize: this.mcpRecommendationCache.size,
      indexStatistics: this.toolIndexer.getStatistics(),
      config: this.config,
      mcpIntegration: {
        enabled: this.enableMCPIntegration,
        hasServerRegistry: !!this.mcpServerRegistry,
        hasPackageManager: !!this.mcpPackageManager,
        collectionName: this.mcpCollectionName
      }
    };
  }
}