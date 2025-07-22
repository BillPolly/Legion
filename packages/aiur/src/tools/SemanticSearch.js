/**
 * SemanticSearch - Advanced tool search with vector embeddings and context awareness
 * 
 * Provides semantic search capabilities for finding tools using natural language,
 * vector similarity, and context-aware ranking
 */

export class SemanticSearch {
  constructor(toolRegistry, options = {}) {
    if (!toolRegistry) {
      throw new Error('Tool registry is required');
    }
    
    this.toolRegistry = toolRegistry;
    
    this.options = {
      enableVectorSearch: options.enableVectorSearch !== false,
      enableContextAware: options.enableContextAware !== false,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes default
      embeddingDimensions: options.embeddingDimensions || 128,
      ...options
    };
    
    // Initialize caches
    this.embeddingCache = new Map();
    this.searchCache = new Map();
    this.cacheTimestamps = new Map();
    
    // Search analytics
    this.searchHistory = [];
    this.toolUsage = new Map();
    this.searchTimes = [];
    
    // Pre-generate embeddings if vector search is enabled
    if (this.options.enableVectorSearch) {
      this.toolEmbeddings = this.generateToolEmbeddings();
    }
  }

  /**
   * Main search method
   */
  async search(query, options = {}) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // Check cache
    const cacheKey = JSON.stringify({ query, options });
    let fromCache = false;
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      const timestamp = this.cacheTimestamps.get(cacheKey);
      if (Date.now() - timestamp < this.options.cacheTTL) {
        // Still record the search in analytics
        if (query !== '*') {
          this.searchHistory.push({
            query,
            timestamp: new Date(),
            options,
            fromCache: true
          });
        }
        return cached;
      }
    }
    
    const startTime = Date.now();
    
    let results = [];
    
    // Don't record wildcard searches in history
    const isWildcard = query === '*';
    
    // Handle wildcard search
    if (isWildcard) {
      results = this.getAllTools();
    } else {
      // Perform search
      results = await this._performSearch(query, options);
    }
    
    // Apply filters
    if (options.filters) {
      results = this._applyFilters(results, options.filters);
    }
    
    // Apply score threshold
    if (options.minScore) {
      results = results.filter(r => r.score >= options.minScore);
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    // Cache results
    this.searchCache.set(cacheKey, results);
    this.cacheTimestamps.set(cacheKey, Date.now());
    
    // Track search time
    const searchTime = Date.now() - startTime;
    this.searchTimes.push(searchTime);
    
    // Record search for analytics (skip wildcards)
    if (!isWildcard) {
      this.searchHistory.push({
        query,
        timestamp: new Date(),
        options
      });
    }
    
    return results;
  }

  /**
   * Search with context awareness
   */
  async searchWithContext(query, handleRegistry, options = {}) {
    const baseResults = await this.search(query, options);
    
    if (!this.options.enableContextAware) {
      return baseResults;
    }
    
    // Enhance results with context
    const contextualResults = baseResults.map(result => {
      const enhanced = { ...result };
      
      // Handle context boost
      enhanced.contextBoost = this._calculateContextBoost(result.tool, handleRegistry);
      
      // Usage boost
      enhanced.usageBoost = this._calculateUsageBoost(result.tool);
      
      // Parameter match
      enhanced.parameterMatch = this._calculateParameterMatch(result.tool, handleRegistry);
      
      // Combined score
      if (options.combineScores) {
        enhanced.combinedScore = this._combineScores(enhanced);
      }
      
      return enhanced;
    });
    
    // Re-sort if combined scores are used
    if (options.combineScores) {
      contextualResults.sort((a, b) => b.combinedScore - a.combinedScore);
    }
    
    return contextualResults;
  }

  /**
   * Perform semantic search using vector similarity
   */
  async semanticSearch(query, options = {}) {
    if (!this.options.enableVectorSearch) {
      return this.search(query, options);
    }
    
    const queryEmbedding = this.generateEmbedding(query);
    const results = [];
    
    for (const [toolName, toolEmbedding] of this.toolEmbeddings) {
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, toolEmbedding);
      
      if (similarity > 0.2) { // Threshold for relevance
        results.push({
          tool,
          score: similarity,
          matchType: 'semantic'
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(prefix) {
    const suggestions = new Set();
    
    // Add tool names
    const tools = this.toolRegistry.getAllTools();
    for (const tool of tools) {
      if (tool.name.startsWith(prefix)) {
        suggestions.add(tool.name);
      }
      
      // Add tags
      if (tool.tags) {
        for (const tag of tool.tags) {
          if (tag.startsWith(prefix)) {
            suggestions.add(tag);
          }
        }
      }
    }
    
    // Add common terms from descriptions
    const terms = this._extractCommonTerms();
    for (const term of terms) {
      if (term.startsWith(prefix)) {
        suggestions.add(term);
      }
    }
    
    return Array.from(suggestions).sort();
  }

  /**
   * Record tool usage for ranking
   */
  recordToolUsage(toolName) {
    const count = this.toolUsage.get(toolName) || 0;
    this.toolUsage.set(toolName, count + 1);
  }

  /**
   * Get popular tools based on usage
   */
  getPopularTools(limit = 10) {
    const tools = Array.from(this.toolUsage.entries())
      .map(([name, usageCount]) => ({ name, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
    
    return tools;
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics() {
    const queryCount = new Map();
    
    for (const search of this.searchHistory) {
      const count = queryCount.get(search.query) || 0;
      queryCount.set(search.query, count + 1);
    }
    
    const topQueries = Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const averageSearchTime = this.searchTimes && this.searchTimes.length > 0
      ? this.searchTimes.reduce((a, b) => a + b, 0) / this.searchTimes.length
      : 0;
    
    return {
      totalSearches: this.searchHistory.length,
      uniqueQueries: queryCount.size,
      topQueries,
      averageSearchTime,
      searchTimes: this.searchTimes || []
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let expired = 0;
    const now = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > this.options.cacheTTL) {
        expired++;
      }
    }
    
    return {
      size: this.searchCache.size,
      expired,
      hitRate: this.cacheHits ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
    };
  }

  /**
   * Invalidate search cache
   */
  invalidateCache() {
    this.searchCache.clear();
    this.cacheTimestamps.clear();
    
    // Regenerate embeddings if needed
    if (this.options.enableVectorSearch) {
      this.toolEmbeddings = this.generateToolEmbeddings();
    }
  }

  /**
   * Generate embeddings for all tools
   */
  generateToolEmbeddings() {
    const embeddings = new Map();
    const tools = this.toolRegistry.getAllTools();
    
    for (const tool of tools) {
      const text = this._getToolText(tool);
      const embedding = this.generateEmbedding(text);
      embeddings.set(tool.name, embedding);
    }
    
    return embeddings;
  }

  /**
   * Generate embedding for text (simplified version)
   */
  generateEmbedding(text) {
    // This is a simplified embedding generation
    // In production, you would use a proper embedding model
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.options.embeddingDimensions).fill(0);
    
    // Create word frequency map
    const wordFreq = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    // Generate embedding based on word presence and position
    let position = 0;
    for (const word of words) {
      // Hash word to multiple dimensions for better distribution
      const hash1 = this._hashString(word);
      const hash2 = this._hashString(word + '2');
      const hash3 = this._hashString(word + '3');
      
      // Distribute word across multiple dimensions
      embedding[hash1 % this.options.embeddingDimensions] += wordFreq[word];
      embedding[hash2 % this.options.embeddingDimensions] += wordFreq[word] * 0.7;
      embedding[hash3 % this.options.embeddingDimensions] += wordFreq[word] * 0.5;
      
      // Add positional encoding
      embedding[(hash1 + position) % this.options.embeddingDimensions] += 0.3;
      position++;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }
  
  /**
   * Simple string hash function
   * @private
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
    }
    
    return dotProduct;
  }

  /**
   * Convert to MCP tool
   */
  asMCPTool() {
    return {
      name: 'search_tools',
      description: 'Search for tools using natural language queries',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10
          },
          category: {
            type: 'string',
            description: 'Filter by category'
          },
          minScore: {
            type: 'number',
            description: 'Minimum relevance score',
            default: 0.1
          }
        },
        required: ['query']
      },
      execute: async (params) => {
        try {
          const results = await this.search(params.query, {
            limit: params.limit,
            minScore: params.minScore,
            filters: params.category ? { category: params.category } : undefined
          });
          
          return {
            success: true,
            results: results.map(r => ({
              name: r.tool.name,
              description: r.tool.description,
              score: r.score,
              matchType: r.matchType
            }))
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
   * Get all tools as search results
   * @private
   */
  getAllTools() {
    const tools = this.toolRegistry.getAllTools();
    return tools.map(tool => ({
      tool,
      score: 1.0,
      matchType: 'all'
    }));
  }

  /**
   * Perform the actual search
   * @private
   */
  async _performSearch(query, options) {
    const results = [];
    const tools = this.toolRegistry.getAllTools();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    for (const tool of tools) {
      let score = 0;
      let matchType = null;
      
      // Exact name match
      if (tool.name === query) {
        score = 1.0;
        matchType = 'exact';
      }
      // Fuzzy name match
      else if (options.fuzzy && this._fuzzyMatch(tool.name, query)) {
        score = 0.8;
        matchType = 'fuzzy';
      }
      // Name contains query
      else if (tool.name.toLowerCase().includes(queryLower)) {
        score = 0.7;
        matchType = 'keyword';
      }
      // Description match
      else if (tool.description && tool.description.toLowerCase().includes(queryLower)) {
        score = 0.5;
        matchType = 'keyword';
      }
      // Tag match
      else if (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        score = 0.4;
        matchType = 'keyword';
      }
      // Multi-word match
      else if (queryWords.length > 1) {
        const matches = queryWords.filter(word => 
          tool.name.toLowerCase().includes(word) ||
          (tool.description && tool.description.toLowerCase().includes(word)) ||
          (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(word)))
        );
        if (matches.length > 0) {
          score = 0.3 * (matches.length / queryWords.length);
          matchType = 'keyword';
        }
      }
      
      if (score > 0) {
        results.push({ tool, score, matchType });
      }
    }
    
    // Only add semantic results if no keyword matches found
    if (results.length === 0 && this.options.enableVectorSearch) {
      const semanticResults = await this.semanticSearch(query);
      results.push(...semanticResults);
    }
    
    return results;
  }

  /**
   * Apply filters to results
   * @private
   */
  _applyFilters(results, filters) {
    return results.filter(result => {
      const tool = result.tool;
      
      if (filters.category && tool.category !== filters.category) {
        return false;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        if (!tool.tags || !filters.tags.some(tag => tool.tags.includes(tag))) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Calculate context boost based on handles
   * @private
   */
  _calculateContextBoost(tool, handleRegistry) {
    let boost = 0;
    const handles = handleRegistry.listHandles();
    
    for (const handle of handles) {
      // Check if handle data suggests this tool
      if (tool.category === 'file' && handle.name.includes('file')) {
        boost += 0.1;
      }
      
      // Check parameter compatibility
      if (tool.inputSchema && tool.inputSchema.properties) {
        for (const param of Object.keys(tool.inputSchema.properties)) {
          if (handle.name.toLowerCase().includes(param.toLowerCase())) {
            boost += 0.05;
          }
        }
      }
    }
    
    return Math.min(boost, 0.3); // Cap at 0.3
  }

  /**
   * Calculate usage boost
   * @private
   */
  _calculateUsageBoost(tool) {
    const usage = this.toolUsage.get(tool.name) || 0;
    return Math.min(usage * 0.02, 0.2); // Cap at 0.2
  }

  /**
   * Calculate parameter match score
   * @private
   */
  _calculateParameterMatch(tool, handleRegistry) {
    let score = 0;
    
    if (!tool.inputSchema || !tool.inputSchema.properties) {
      return score;
    }
    
    const handles = handleRegistry.listHandles();
    const paramNames = Object.keys(tool.inputSchema.properties);
    
    for (const param of paramNames) {
      for (const handle of handles) {
        // Check if handle name matches parameter name
        if (handle.name === param || 
            handle.name.toLowerCase().includes(param.toLowerCase()) ||
            param.toLowerCase().includes(handle.name.toLowerCase())) {
          score += 0.1;
        }
        
        // Check if handle name matches a related concept
        // e.g., 'apiUrl' handle might match 'url' parameter
        const handleWords = handle.name.toLowerCase().split(/(?=[A-Z])|[_-]/).filter(w => w);
        const paramWords = param.toLowerCase().split(/(?=[A-Z])|[_-]/).filter(w => w);
        
        if (handleWords.some(hw => paramWords.includes(hw)) ||
            paramWords.some(pw => handleWords.includes(pw))) {
          score += 0.05;
        }
      }
    }
    
    return Math.min(score, 0.5);
  }

  /**
   * Combine multiple scores
   * @private
   */
  _combineScores(result) {
    return result.score + 
           (result.contextBoost || 0) + 
           (result.usageBoost || 0) + 
           (result.parameterMatch || 0);
  }

  /**
   * Get tool text for embedding
   * @private
   */
  _getToolText(tool) {
    const parts = [tool.name, tool.description];
    
    if (tool.tags) {
      parts.push(...tool.tags);
    }
    
    if (tool.category) {
      parts.push(tool.category);
    }
    
    return parts.filter(Boolean).join(' ');
  }

  /**
   * Extract common terms from tool descriptions
   * @private
   */
  _extractCommonTerms() {
    const terms = new Set();
    const tools = this.toolRegistry.getAllTools();
    
    for (const tool of tools) {
      if (tool.description) {
        const words = tool.description.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 3) {
            terms.add(word);
          }
        }
      }
    }
    
    return Array.from(terms);
  }

  /**
   * Simple fuzzy matching
   * @private
   */
  _fuzzyMatch(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Check for typos (like fil_red vs file_read)
    const s1Clean = s1.replace(/[_-]/g, '');
    const s2Clean = s2.replace(/[_-]/g, '');
    
    // First check if they're very similar after removing separators
    if (s1Clean === s2Clean) return true;
    
    // Levenshtein distance approximation
    if (Math.abs(s1.length - s2.length) > 3) return false;
    
    let matches = 0;
    let s1Pos = 0;
    let s2Pos = 0;
    
    while (s1Pos < s1.length && s2Pos < s2.length) {
      if (s1[s1Pos] === s2[s2Pos]) {
        matches++;
        s1Pos++;
        s2Pos++;
      } else if (s1Pos + 1 < s1.length && s1[s1Pos + 1] === s2[s2Pos]) {
        s1Pos++;
      } else if (s2Pos + 1 < s2.length && s1[s1Pos] === s2[s2Pos + 1]) {
        s2Pos++;
      } else {
        s1Pos++;
        s2Pos++;
      }
    }
    
    return matches / Math.max(s1.length, s2.length) > 0.7;
  }
}