/**
 * ContextAwareLoader - Smart tool loading based on current context
 * 
 * Analyzes handles, working set, and usage patterns to suggest
 * and automatically load relevant tools
 */

import { EventEmitter } from 'events';

export class ContextAwareLoader extends EventEmitter {
  constructor(toolRegistry, handleRegistry, workingSet, options = {}) {
    super();
    
    if (!toolRegistry || !handleRegistry || !workingSet) {
      throw new Error('ToolRegistry, HandleRegistry, and WorkingSet are required');
    }
    
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.workingSet = workingSet;
    
    this.options = {
      enableSmartSuggestions: options.enableSmartSuggestions !== false,
      enableAutoDependencies: options.enableAutoDependencies !== false,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      ...options
    };
    
    // Usage tracking
    this.toolUsage = new Map();
    this.toolSequences = [];
    this.contextCache = new Map();
    this.cacheTimestamps = new Map();
    
    // Pattern detection
    this.workflowPatterns = {
      file_processing: ['file_read', 'json_parse', 'file_write'],
      api_integration: ['http_get', 'api_fetch', 'json_parse'],
      version_control: ['git_clone', 'git_commit'],
      data_transformation: ['parse', 'transform', 'serialize']
    };
  }

  /**
   * Suggest tools based on current handles
   */
  async suggestToolsFromHandles() {
    const suggestions = [];
    const handles = this.handleRegistry.listHandles();
    
    for (const handle of handles) {
      const handleData = handle.data;
      const toolSuggestions = this._getToolsForHandleType(handleData);
      
      for (const toolName of toolSuggestions) {
        const tool = this.toolRegistry.getTool(toolName);
        if (!tool) continue;
        
        const score = this._calculateHandleRelevance(tool, handleData);
        suggestions.push({
          tool: toolName,
          score,
          reason: `Handle '${handle.name}' suggests this tool`,
          handleMatch: handle.name
        });
      }
    }
    
    // Sort by score and deduplicate
    return this._deduplicateAndSort(suggestions);
  }

  /**
   * Detect patterns in handles
   */
  async detectHandlePatterns() {
    const handles = this.handleRegistry.listHandles();
    const patterns = {
      fileWorkflow: false,
      apiWorkflow: false,
      dataWorkflow: false,
      suggestedCategories: new Set()
    };
    
    // Analyze handle types
    let fileHandles = 0;
    let apiHandles = 0;
    let dataHandles = 0;
    
    for (const handle of handles) {
      const data = handle.data;
      
      if (this._isFileHandle(data)) {
        fileHandles++;
        patterns.suggestedCategories.add('file');
      }
      if (this._isApiHandle(data)) {
        apiHandles++;
        patterns.suggestedCategories.add('network');
      }
      if (this._isDataHandle(data)) {
        dataHandles++;
        patterns.suggestedCategories.add('data');
      }
    }
    
    // Detect workflows
    patterns.fileWorkflow = fileHandles >= 2;
    patterns.apiWorkflow = apiHandles >= 1;
    patterns.dataWorkflow = dataHandles >= 1;
    
    patterns.suggestedCategories = Array.from(patterns.suggestedCategories);
    
    return patterns;
  }

  /**
   * Suggest tools based on handle parameters
   */
  async suggestToolsForParameters() {
    const suggestions = [];
    const handles = this.handleRegistry.listHandles();
    
    for (const handle of handles) {
      const handleValue = handle.data;
      
      // Check if handle name or value suggests specific tools
      const tools = this.toolRegistry.getAllTools();
      for (const tool of tools) {
        if (!tool.inputSchema?.properties) continue;
        
        const params = Object.keys(tool.inputSchema.properties);
        for (const param of params) {
          if (this._parameterMatches(param, handle.name, handleValue)) {
            suggestions.push({
              tool: tool.name,
              score: 0.7,
              reason: `Handle '${handle.name}' matches parameter '${param}'`,
              paramMatch: param
            });
          }
        }
      }
    }
    
    return this._deduplicateAndSort(suggestions);
  }

  /**
   * Detect workflow based on context
   */
  async detectWorkflow() {
    const handles = this.handleRegistry.listHandles();
    const activeTools = this.workingSet.getActiveTools();
    
    // Check for git workflow first (most specific)
    if (this._detectGitWorkflow(handles, activeTools)) {
      return {
        type: 'version_control',
        confidence: 0.8,
        suggestedTools: ['git_clone', 'git_commit', 'file_write']
      };
    }
    
    // Check for API workflow
    if (this._detectApiWorkflow(handles, activeTools)) {
      return {
        type: 'api_integration',
        confidence: 0.8,
        suggestedTools: ['api_fetch', 'json_parse', 'http_get']
      };
    }
    
    // Check for file processing workflow
    if (this._detectFileProcessingWorkflow(handles, activeTools)) {
      return {
        type: 'file_processing',
        confidence: 0.8,
        suggestedTools: ['json_parse', 'file_write', 'json_stringify']
      };
    }
    
    // Check for mixed workflow
    if (handles.length >= 2 && activeTools.length >= 1) {
      const allSuggestions = new Set();
      const patterns = await this.detectHandlePatterns();
      
      for (const category of patterns.suggestedCategories) {
        const categoryTools = this.toolRegistry.getToolsByCategory(category);
        categoryTools.forEach(tool => allSuggestions.add(tool.name));
      }
      
      return {
        type: 'mixed',
        confidence: 0.6,
        suggestedTools: Array.from(allSuggestions)
      };
    }
    
    return {
      type: 'unknown',
      confidence: 0.3,
      suggestedTools: []
    };
  }

  /**
   * Auto-activate tools based on context
   */
  async autoActivateTools(options = {}) {
    const suggestions = await this.suggestToolsFromHandles();
    const workflow = await this.detectWorkflow();
    
    // Combine suggestions
    const toolsToActivate = new Set();
    
    // Add high-score suggestions
    suggestions
      .filter(s => s.score >= 0.5) // Lower threshold for auto-activation
      .forEach(s => toolsToActivate.add(s.tool));
    
    // Add workflow tools
    workflow.suggestedTools.forEach(tool => toolsToActivate.add(tool));
    
    // Handle dependencies
    if (options.includeChains) {
      const allTools = Array.from(toolsToActivate);
      for (const tool of allTools) {
        const deps = await this.loadToolDependencies(tool);
        if (Array.isArray(deps)) {
          deps.forEach(dep => toolsToActivate.add(dep));
        }
      }
    }
    
    // Respect working set limits
    if (options.respectLimits) {
      const currentSize = this.workingSet.getActiveTools().length;
      const available = this.workingSet.options.maxSize - currentSize;
      const toolsArray = Array.from(toolsToActivate);
      
      // Prioritize by frequency if enabled
      if (options.useFrequency) {
        toolsArray.sort((a, b) => {
          const freqA = this.toolUsage.get(a) || 0;
          const freqB = this.toolUsage.get(b) || 0;
          return freqB - freqA;
        });
      }
      
      // Only activate what fits
      for (let i = 0; i < Math.min(available, toolsArray.length); i++) {
        this.workingSet.activateTool(toolsArray[i]);
      }
    } else {
      // Activate all
      for (const tool of toolsToActivate) {
        this.workingSet.activateTool(tool);
      }
    }
  }

  /**
   * Load tool dependencies
   */
  async loadToolDependencies(toolName, options = {}) {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) return [];
    
    const dependencies = new Set();
    const visited = new Set();
    
    const loadDeps = (name, path = []) => {
      if (visited.has(name)) {
        if (options.detectCircular) {
          return {
            error: 'circular_dependency',
            cycle: [...path, name]
          };
        }
        return;
      }
      
      visited.add(name);
      const t = this.toolRegistry.getTool(name);
      
      if (t?.dependencies) {
        for (const dep of t.dependencies) {
          if (path.includes(dep)) {
            if (options.detectCircular) {
              return {
                error: 'circular_dependency',
                cycle: [...path, name, dep]
              };
            }
          }
          dependencies.add(dep);
          if (options.includeTransitive) {
            const result = loadDeps(dep, [...path, name]);
            if (result?.error) return result;
          }
        }
      }
    };
    
    const result = loadDeps(toolName, []);
    if (result?.error) return result;
    
    return Array.from(dependencies);
  }

  /**
   * Load tool with dependencies
   */
  async loadToolWithDependencies(toolName) {
    const dependencies = await this.loadToolDependencies(toolName, {
      includeTransitive: true
    });
    
    // Load in dependency order
    for (const dep of dependencies) {
      this.workingSet.activateTool(dep);
      this.emit('tool-loaded', dep);
    }
    
    // Load the main tool
    this.workingSet.activateTool(toolName);
    this.emit('tool-loaded', toolName);
  }

  /**
   * Analyze current context
   */
  async analyzeContext() {
    // Check cache
    const cacheKey = this._getContextCacheKey();
    if (this._isCacheValid(cacheKey)) {
      return this.contextCache.get(cacheKey);
    }
    
    const handles = this.handleRegistry.listHandles();
    const activeTools = this.workingSet.getActiveTools();
    
    const analysis = {
      handleCount: handles.length,
      activeToolCount: activeTools.length,
      handleRelationships: [],
      suggestedWorkflow: null,
      confidence: 0
    };
    
    // Analyze handle relationships
    for (let i = 0; i < handles.length; i++) {
      for (let j = i + 1; j < handles.length; j++) {
        const relation = this._analyzeHandleRelation(handles[i], handles[j]);
        if (relation) {
          analysis.handleRelationships.push(relation);
        }
      }
    }
    
    // Get workflow
    const workflow = await this.detectWorkflow();
    analysis.suggestedWorkflow = workflow.type;
    analysis.confidence = workflow.confidence;
    
    // Cache result
    this.contextCache.set(cacheKey, analysis);
    this.cacheTimestamps.set(cacheKey, Date.now());
    
    return analysis;
  }

  /**
   * Analyze data flow patterns
   */
  async analyzeDataFlow() {
    const handles = this.handleRegistry.listHandles();
    const flow = {
      stages: [],
      transformations: []
    };
    
    // Build flow graph
    const handleMap = new Map();
    handles.forEach(h => {
      const data = h.data;
      handleMap.set(h.name, data);
    });
    
    // Detect stages
    for (const [name, data] of handleMap) {
      const stage = {
        handle: name,
        type: this._getHandleType(data),
        dependencies: []
      };
      
      // Check if handle references others
      if (typeof data === 'object' && data.source) {
        const sourceName = data.source.replace('@', '');
        if (handleMap.has(sourceName)) {
          stage.dependencies.push(sourceName);
        }
      }
      
      flow.stages.push(stage);
    }
    
    // Detect transformations
    for (let i = 0; i < flow.stages.length - 1; i++) {
      const from = flow.stages[i];
      const to = flow.stages[i + 1];
      
      if (to.dependencies.includes(from.handle)) {
        const transformation = this._inferTransformation(from.type, to.type);
        if (transformation) {
          flow.transformations.push(transformation);
        }
      }
    }
    
    // If no dependencies found, infer transformations from types
    if (flow.transformations.length === 0 && flow.stages.length > 1) {
      for (let i = 0; i < flow.stages.length - 1; i++) {
        const transformation = this._inferTransformation(flow.stages[i].type, flow.stages[i + 1].type);
        if (transformation) {
          flow.transformations.push(transformation);
        }
      }
    }
    
    return flow;
  }

  /**
   * Capture current context
   */
  async captureContext() {
    return {
      handles: this.handleRegistry.listHandles().map(h => ({
        name: h.name,
        data: h.data
      })),
      activeTools: this.workingSet.getActiveTools(),
      timestamp: new Date()
    };
  }

  /**
   * Compare contexts
   */
  async compareContext(otherContext) {
    const currentContext = await this.captureContext();
    
    // Compare handles
    const currentHandles = new Set(currentContext.handles.map(h => h.name));
    const otherHandles = new Set(otherContext.handles.map(h => h.name));
    
    const handleOverlap = this._setOverlap(currentHandles, otherHandles);
    
    // Compare tools
    const currentTools = new Set(currentContext.activeTools);
    const otherTools = new Set(otherContext.activeTools);
    
    const toolOverlap = this._setOverlap(currentTools, otherTools);
    
    // Calculate similarity (weighted average)
    return handleOverlap * 0.6 + toolOverlap * 0.4;
  }

  /**
   * Get smart suggestions
   */
  async getSmartSuggestions(options = {}) {
    const suggestions = [];
    
    // Get handle-based suggestions
    const handleSuggestions = await this.suggestToolsFromHandles();
    suggestions.push(...handleSuggestions);
    
    // Get parameter-based suggestions
    const paramSuggestions = await this.suggestToolsForParameters();
    suggestions.push(...paramSuggestions);
    
    // Get pattern-based suggestions
    if (options.usePatterns) {
      const patternSuggestions = this._getPatternSuggestions();
      suggestions.push(...patternSuggestions);
    }
    
    // Deduplicate and sort
    const deduplicated = this._deduplicateAndSort(suggestions);
    
    // Add explanations if requested
    if (options.includeExplanations) {
      deduplicated.forEach(s => {
        s.explanation = this._generateExplanation(s);
      });
    }
    
    // Apply limit
    if (options.limit && deduplicated.length > 0) {
      return deduplicated.slice(0, options.limit);
    }
    
    // If no suggestions found yet, suggest some default tools
    if (deduplicated.length === 0) {
      const allTools = this.toolRegistry.getAllTools();
      const defaultSuggestions = allTools.slice(0, options.limit || 5).map(tool => ({
        tool: tool.name,
        score: 0.3,
        reason: 'Default suggestion'
      }));
      return defaultSuggestions;
    }
    
    return deduplicated;
  }

  /**
   * Suggest tool combinations
   */
  async suggestToolCombinations() {
    const handles = this.handleRegistry.listHandles();
    const combinations = [];
    
    // Check for data transformation combinations
    const hasInput = handles.some(h => h.name.includes('input') || h.name.includes('csv'));
    const hasOutput = handles.some(h => h.name.includes('output') || h.name.includes('Format'));
    
    if (hasInput && hasOutput) {
      combinations.push({
        tools: ['file_read', 'json_parse', 'file_write'],
        purpose: 'Transform data from input to output format',
        confidence: 0.8
      });
    }
    
    // Check for API combinations
    const hasApi = handles.some(h => {
      const data = h.data;
      return this._isApiHandle(data);
    });
    
    if (hasApi) {
      combinations.push({
        tools: ['http_get', 'json_parse'],
        purpose: 'Fetch and parse API data',
        confidence: 0.7
      });
    }
    
    return combinations;
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName, count = 1) {
    const current = this.toolUsage.get(toolName) || 0;
    this.toolUsage.set(toolName, current + count);
  }

  /**
   * Record tool sequence
   */
  recordToolSequence(sequence) {
    this.toolSequences.push({
      tools: sequence,
      timestamp: new Date()
    });
    
    // Keep only recent sequences
    if (this.toolSequences.length > 100) {
      this.toolSequences = this.toolSequences.slice(-100);
    }
  }

  /**
   * Load multiple tools in batch
   */
  async loadToolsBatch(toolNames) {
    const loaded = [];
    
    for (const name of toolNames) {
      if (this.toolRegistry.getTool(name)) {
        this.workingSet.activateTool(name);
        loaded.push(name);
      }
    }
    
    this.emit('tools-loaded', loaded);
    return loaded;
  }

  /**
   * Export context snapshot
   */
  async exportSnapshot() {
    const context = await this.captureContext();
    
    return {
      handles: context.handles,
      activeTools: context.activeTools,
      toolUsage: Object.fromEntries(this.toolUsage),
      patterns: this.toolSequences.slice(-10),
      timestamp: new Date(),
      version: '1.0'
    };
  }

  /**
   * Import context snapshot
   */
  async importSnapshot(snapshot) {
    // Import handles
    if (snapshot.handles) {
      for (const handle of snapshot.handles) {
        this.handleRegistry.create(handle.name, handle.data);
      }
    }
    
    // Import active tools
    if (snapshot.activeTools) {
      for (const tool of snapshot.activeTools) {
        if (this.toolRegistry.getTool(tool)) {
          this.workingSet.activateTool(tool);
        }
      }
    }
    
    // Import usage if available
    if (snapshot.toolUsage) {
      for (const [tool, count] of Object.entries(snapshot.toolUsage)) {
        this.toolUsage.set(tool, count);
      }
    }
  }

  /**
   * Convert to MCP tool
   */
  asMCPTool() {
    return {
      name: 'context_suggest',
      description: 'Get context-aware tool suggestions',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum suggestions to return',
            default: 10
          },
          includeExplanations: {
            type: 'boolean',
            description: 'Include explanations for suggestions',
            default: false
          },
          usePatterns: {
            type: 'boolean',
            description: 'Use historical patterns',
            default: true
          }
        }
      },
      execute: async (params) => {
        try {
          const suggestions = await this.getSmartSuggestions(params);
          return {
            success: true,
            suggestions
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Helper: Get tools for handle type
   * @private
   */
  _getToolsForHandleType(handleData) {
    const suggestions = [];
    
    if (this._isFileHandle(handleData)) {
      suggestions.push('file_read', 'file_write');
      if (this._isJsonFile(handleData)) {
        suggestions.push('json_parse', 'json_stringify');
      }
    }
    
    if (this._isApiHandle(handleData)) {
      suggestions.push('http_get', 'api_fetch');
    }
    
    if (this._isDataHandle(handleData)) {
      suggestions.push('json_parse', 'json_stringify');
    }
    
    return suggestions;
  }

  /**
   * Helper: Calculate handle relevance
   * @private
   */
  _calculateHandleRelevance(tool, handleData) {
    let score = 0.5; // Base score
    
    // Check category match
    if (this._isFileHandle(handleData) && tool.category === 'file') {
      score += 0.2;
    }
    if (this._isApiHandle(handleData) && tool.category === 'network') {
      score += 0.2;
    }
    
    // Check tag matches
    const handleType = this._getHandleType(handleData);
    if (tool.tags && tool.tags.includes(handleType)) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Helper: Check if file handle
   * @private
   */
  _isFileHandle(data) {
    if (typeof data === 'string') {
      return data.includes('.') || data.includes('/');
    }
    if (typeof data === 'object' && data !== null) {
      return data.type === 'file' || 
             data.path !== undefined ||
             data.format !== undefined;
    }
    return false;
  }

  /**
   * Helper: Check if JSON file
   * @private
   */
  _isJsonFile(data) {
    if (typeof data === 'string') {
      return data.endsWith('.json');
    }
    if (typeof data === 'object' && data !== null) {
      return data.format === 'json' || 
             (data.path && data.path.endsWith('.json'));
    }
    return false;
  }

  /**
   * Helper: Check if API handle
   * @private
   */
  _isApiHandle(data) {
    if (typeof data === 'string') {
      return data.startsWith('http') || 
             data.includes('api') ||
             data.includes('endpoint');
    }
    if (typeof data === 'object' && data !== null) {
      return data.type === 'api' || 
             data.source === 'api' ||
             data.endpoint !== undefined;
    }
    return false;
  }

  /**
   * Helper: Check if data handle
   * @private
   */
  _isDataHandle(data) {
    if (typeof data === 'object' && data !== null) {
      return data.type === 'json' || 
             data.type === 'data' ||
             data.data !== undefined;
    }
    return false;
  }

  /**
   * Helper: Get handle type
   * @private
   */
  _getHandleType(data) {
    if (this._isFileHandle(data)) return 'file';
    if (this._isApiHandle(data)) return 'api';
    if (this._isDataHandle(data)) return 'data';
    if (typeof data === 'object' && data?.type) return data.type;
    return 'unknown';
  }

  /**
   * Helper: Check parameter match
   * @private
   */
  _parameterMatches(param, handleName, handleValue) {
    const paramLower = param.toLowerCase();
    const nameLower = handleName.toLowerCase();
    
    // Direct match
    if (paramLower === nameLower) return true;
    
    // Partial match
    if (paramLower.includes(nameLower) || nameLower.includes(paramLower)) {
      return true;
    }
    
    // Semantic match
    const semanticPairs = [
      ['url', 'endpoint'],
      ['path', 'file'],
      ['token', 'key'],
      ['data', 'json']
    ];
    
    for (const [a, b] of semanticPairs) {
      if ((paramLower.includes(a) && nameLower.includes(b)) ||
          (paramLower.includes(b) && nameLower.includes(a))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Helper: Detect file processing workflow
   * @private
   */
  _detectFileProcessingWorkflow(handles, activeTools) {
    const hasFileHandles = handles.some(h => {
      const data = h.data;
      return this._isFileHandle(data);
    });
    
    const hasFileTools = activeTools.some(toolName => {
      const tool = this.toolRegistry.getTool(toolName);
      return tool && tool.category === 'file';
    });
    
    return hasFileHandles || hasFileTools;
  }

  /**
   * Helper: Detect API workflow
   * @private
   */
  _detectApiWorkflow(handles, activeTools) {
    const hasApiHandles = handles.some(h => {
      const data = h.data;
      return this._isApiHandle(data);
    });
    
    const hasNetworkTools = activeTools.some(toolName => {
      const tool = this.toolRegistry.getTool(toolName);
      return tool && tool.category === 'network';
    });
    
    return hasApiHandles || hasNetworkTools;
  }

  /**
   * Helper: Detect git workflow
   * @private
   */
  _detectGitWorkflow(handles, activeTools) {
    const hasGitHandles = handles.some(h => {
      const data = h.data;
      const name = h.name.toLowerCase();
      return name.includes('repo') || name.includes('git') ||
             (typeof data === 'string' && (data.includes('.git') || data.includes('github.com')));
    });
    
    const hasGitTools = activeTools.some(toolName => {
      const tool = this.toolRegistry.getTool(toolName);
      return tool && tool.category === 'vcs';
    });
    
    return hasGitHandles || hasGitTools;
  }

  /**
   * Helper: Deduplicate and sort suggestions
   * @private
   */
  _deduplicateAndSort(suggestions) {
    const toolMap = new Map();
    
    for (const suggestion of suggestions) {
      const existing = toolMap.get(suggestion.tool);
      if (!existing || suggestion.score > existing.score) {
        toolMap.set(suggestion.tool, suggestion);
      }
    }
    
    return Array.from(toolMap.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Helper: Get context cache key
   * @private
   */
  _getContextCacheKey() {
    const handles = this.handleRegistry.listHandles()
      .map(h => h.name)
      .sort()
      .join('|');
    const tools = this.workingSet.getActiveTools()
      .map(t => t.name)
      .sort()
      .join('|');
    
    return `${handles}::${tools}`;
  }

  /**
   * Helper: Check cache validity
   * @private
   */
  _isCacheValid(key) {
    if (!this.contextCache.has(key)) return false;
    
    const timestamp = this.cacheTimestamps.get(key);
    return Date.now() - timestamp < this.options.cacheTimeout;
  }

  /**
   * Helper: Analyze handle relation
   * @private
   */
  _analyzeHandleRelation(handle1, handle2) {
    const data1 = handle1.data;
    const data2 = handle2.data;
    
    // Check for source relationship
    if (typeof data2 === 'object' && data2?.source === `@${handle1.name}`) {
      return {
        from: handle1.name,
        to: handle2.name,
        type: 'source'
      };
    }
    
    // Check for type relationship
    const type1 = this._getHandleType(data1);
    const type2 = this._getHandleType(data2);
    
    if (type1 === 'file' && type2 === 'file') {
      return {
        from: handle1.name,
        to: handle2.name,
        type: 'similar'
      };
    }
    
    return null;
  }

  /**
   * Helper: Infer transformation
   * @private
   */
  _inferTransformation(fromType, toType) {
    const transformations = {
      'csv:json': 'parse',
      'json:report': 'generate',
      'data:json': 'serialize',
      'file:data': 'read',
      'data:file': 'write'
    };
    
    return transformations[`${fromType}:${toType}`] || null;
  }

  /**
   * Helper: Calculate set overlap
   * @private
   */
  _setOverlap(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;
    
    let intersection = 0;
    for (const item of set1) {
      if (set2.has(item)) intersection++;
    }
    
    const union = set1.size + set2.size - intersection;
    return intersection / union;
  }

  /**
   * Helper: Get pattern suggestions
   * @private
   */
  _getPatternSuggestions() {
    const suggestions = [];
    const currentTools = this.workingSet.getActiveTools().map(t => t.name);
    
    if (currentTools.length === 0) return suggestions;
    
    // Find sequences that start with current tools
    const lastTool = currentTools[currentTools.length - 1];
    const relevantSequences = this.toolSequences.filter(seq => {
      const index = seq.tools.indexOf(lastTool);
      return index >= 0 && index < seq.tools.length - 1;
    });
    
    // Count next tools
    const nextToolCounts = new Map();
    for (const seq of relevantSequences) {
      const index = seq.tools.indexOf(lastTool);
      const nextTool = seq.tools[index + 1];
      nextToolCounts.set(nextTool, (nextToolCounts.get(nextTool) || 0) + 1);
    }
    
    // Create suggestions
    for (const [tool, count] of nextToolCounts) {
      suggestions.push({
        tool,
        score: Math.min(count / relevantSequences.length, 0.9),
        reason: `Often follows ${lastTool} in patterns`,
        patternMatch: true
      });
    }
    
    return suggestions;
  }

  /**
   * Helper: Generate explanation
   * @private
   */
  _generateExplanation(suggestion) {
    const parts = [];
    
    if (suggestion.handleMatch) {
      parts.push(`The handle '${suggestion.handleMatch}' suggests this tool`);
    }
    
    if (suggestion.paramMatch) {
      parts.push(`matches the parameter '${suggestion.paramMatch}'`);
    }
    
    if (suggestion.patternMatch) {
      parts.push('based on historical usage patterns');
    }
    
    if (suggestion.reason) {
      parts.push(suggestion.reason);
    }
    
    // Add JSON context if the tool deals with JSON
    const toolName = suggestion.tool;
    if (toolName && toolName.toLowerCase().includes('json')) {
      parts.push('for JSON data processing');
    }
    
    return parts.join(' and ');
  }
}