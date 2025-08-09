/**
 * @fileoverview LogSearchEnhanced - Advanced search functionality for logs
 * Supports semantic, keyword, regex, and hybrid search modes with caching
 */

import { EventEmitter } from 'events';

export class LogSearchEnhanced extends EventEmitter {
  constructor(options = {}) {
    super();
    
    const {
      semanticSearchProvider = null,
      storageProvider,
      resourceManager
    } = options;

    // Validate required dependencies
    if (!storageProvider) {
      throw new Error('StorageProvider is required');
    }

    this.semanticSearchProvider = semanticSearchProvider;
    this.storageProvider = storageProvider;
    this.resourceManager = resourceManager;
    
    // Search statistics
    this.stats = {
      searches: 0,
      semanticSearches: 0,
      keywordSearches: 0,
      regexSearches: 0,
      hybridSearches: 0,
      lastSearchDuration: 0,
      totalSearchTime: 0
    };
    
    // Cache configuration
    this.cacheConfig = {
      enabled: true,
      ttl: 60000, // 1 minute
      maxSize: 100
    };
    
    // Search result cache
    this.cache = new Map();
    this.cacheTimestamps = new Map();
  }

  /**
   * Perform semantic search on logs
   * @param {string} query - Search query
   * @param {string} sessionId - Optional session ID to search within
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of matching logs with scores
   */
  async semanticSearch(query, sessionId = null, limit = 100) {
    const startTime = Date.now();
    
    if (!this.semanticSearchProvider) {
      throw new Error('Semantic search provider not configured');
    }
    
    try {
      // Generate embedding for query
      const embedding = await this.semanticSearchProvider.generateEmbedding(query);
      
      // Prepare search options
      const searchOptions = {
        limit
      };
      
      if (sessionId) {
        searchOptions.filter = { sessionId };
      }
      
      // Perform vector search
      const results = await this.semanticSearchProvider.search(embedding, searchOptions);
      
      // Enrich results with full log data
      const enrichedResults = await Promise.all(
        results.slice(0, limit).map(async (result) => {
          const log = await this.storageProvider.get('logs', result.id);
          return {
            ...log,
            score: result.score,
            searchType: 'semantic'
          };
        })
      );
      
      // Update statistics
      this.stats.semanticSearches++;
      this.stats.searches++;
      this.stats.lastSearchDuration = Date.now() - startTime;
      this.stats.totalSearchTime += this.stats.lastSearchDuration;
      
      return enrichedResults;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform keyword search on logs
   * @param {string} query - Search query
   * @param {string} sessionId - Optional session ID
   * @param {number} limit - Maximum number of results
   * @param {Object} options - Additional search options
   * @returns {Promise<Array>} Array of matching logs
   */
  async keywordSearch(query, sessionId = null, limit = 100, options = {}) {
    const startTime = Date.now();
    
    // Validate query
    if (!query || query.trim() === '') {
      throw new Error('Search query cannot be empty');
    }
    
    // Validate limit
    if (limit <= 0) {
      throw new Error('Limit must be positive');
    }
    
    // Check cache
    const cacheKey = `keyword:${query}:${sessionId}:${limit}`;
    if (this.cacheConfig.enabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const timestamp = this.cacheTimestamps.get(cacheKey);
      
      if (Date.now() - timestamp < this.cacheConfig.ttl) {
        return cached;
      } else {
        // Cache expired
        this.cache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }
    }
    
    try {
      // Prepare filter for storage query
      const filter = {};
      if (sessionId) {
        filter.sessionId = sessionId;
      }
      
      // Get logs from storage
      const allLogs = await this.storageProvider.query('logs', filter);
      
      // Perform keyword search
      const searchTerm = query.toLowerCase();
      const matchingLogs = allLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm)
      );
      
      // Apply limit and add search type
      const limitedResults = matchingLogs.slice(0, limit).map(log => ({
        ...log,
        searchType: 'keyword'
      }));
      
      // Update cache
      if (this.cacheConfig.enabled) {
        this.updateCache(cacheKey, limitedResults);
      }
      
      // Update statistics
      this.stats.keywordSearches++;
      this.stats.searches++;
      this.stats.lastSearchDuration = Date.now() - startTime;
      this.stats.totalSearchTime += this.stats.lastSearchDuration;
      
      return limitedResults;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform regex search on logs
   * @param {RegExp|string} pattern - Regex pattern
   * @param {string} sessionId - Optional session ID
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of matching logs
   */
  async regexSearch(pattern, sessionId = null, limit = 100) {
    const startTime = Date.now();
    
    // Convert string to RegExp if needed
    let regex;
    if (typeof pattern === 'string') {
      try {
        regex = new RegExp(pattern);
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${error.message}`);
      }
    } else if (pattern instanceof RegExp) {
      regex = pattern;
    } else {
      throw new Error('Pattern must be a RegExp or string');
    }
    
    try {
      // Prepare filter for storage query
      const filter = {};
      if (sessionId) {
        filter.sessionId = sessionId;
      }
      
      // Get logs from storage
      const allLogs = await this.storageProvider.query('logs', filter);
      
      // Apply regex filter
      const matchingLogs = allLogs.filter(log => regex.test(log.message));
      
      // Apply limit and add search type
      const results = matchingLogs.slice(0, limit).map(log => ({
        ...log,
        searchType: 'regex'
      }));
      
      // Update statistics
      this.stats.regexSearches++;
      this.stats.searches++;
      this.stats.lastSearchDuration = Date.now() - startTime;
      this.stats.totalSearchTime += this.stats.lastSearchDuration;
      
      return results;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform hybrid search combining semantic and keyword
   * @param {string} query - Search query
   * @param {string} sessionId - Optional session ID
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of matching logs
   */
  async hybridSearch(query, sessionId = null, limit = 100) {
    const startTime = Date.now();
    const results = [];
    const seenIds = new Set();
    
    // Store initial stats to avoid double counting
    const initialSemanticSearches = this.stats.semanticSearches;
    const initialKeywordSearches = this.stats.keywordSearches;
    const initialTotalSearches = this.stats.searches;
    
    // Try semantic search first
    if (this.semanticSearchProvider) {
      try {
        const semanticResults = await this.semanticSearch(query, sessionId, Math.ceil(limit * 0.6));
        
        for (const result of semanticResults) {
          if (!seenIds.has(result.logId || result.id)) {
            results.push(result);
            seenIds.add(result.logId || result.id);
          }
        }
      } catch (error) {
        // Semantic search failed, continue with keyword
        console.error('Semantic search failed:', error);
      }
    }
    
    // Add keyword search results
    try {
      const keywordResults = await this.keywordSearch(query, sessionId, limit);
      
      for (const result of keywordResults) {
        if (!seenIds.has(result.logId || result.id) && results.length < limit) {
          results.push(result);
          seenIds.add(result.logId || result.id);
        }
      }
    } catch (error) {
      console.error('Keyword search failed:', error);
    }
    
    // Reset stats to initial values and then update with hybrid counts
    this.stats.semanticSearches = initialSemanticSearches;
    this.stats.keywordSearches = initialKeywordSearches;
    this.stats.searches = initialTotalSearches;
    
    // Update statistics for hybrid search only
    this.stats.hybridSearches++;
    this.stats.searches++;
    this.stats.lastSearchDuration = Date.now() - startTime;
    this.stats.totalSearchTime += this.stats.lastSearchDuration;
    
    return results.slice(0, limit);
  }

  /**
   * Index a log entry for semantic search
   * @param {Object} log - Log entry to index
   * @returns {Promise<void>}
   */
  async indexLog(log) {
    if (!this.semanticSearchProvider) {
      // No semantic provider, skip indexing
      return;
    }
    
    try {
      await this.semanticSearchProvider.addDocument({
        id: log.logId || log.id,
        text: log.message,
        metadata: {
          sessionId: log.sessionId,
          timestamp: log.timestamp,
          source: log.source,
          level: log.level
        }
      });
    } catch (error) {
      console.error('Failed to index log:', error);
    }
  }

  /**
   * Batch index multiple logs
   * @param {Array} logs - Array of log entries
   * @returns {Promise<void>}
   */
  async batchIndexLogs(logs) {
    for (const log of logs) {
      await this.indexLog(log);
    }
  }

  /**
   * Update cache with search results
   * @param {string} key - Cache key
   * @param {Array} results - Search results
   */
  updateCache(key, results) {
    // Enforce cache size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
    
    this.cache.set(key, results);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Get search statistics
   * @returns {Object} Statistics summary
   */
  getStatistics() {
    const avgSearchTime = this.stats.searches > 0 
      ? this.stats.totalSearchTime / this.stats.searches 
      : 0;
    
    return {
      totalSearches: this.stats.searches,
      searchTypes: {
        semantic: this.stats.semanticSearches,
        keyword: this.stats.keywordSearches,
        regex: this.stats.regexSearches,
        hybrid: this.stats.hybridSearches
      },
      averageSearchTime: avgSearchTime,
      lastSearchDuration: this.stats.lastSearchDuration,
      totalSearchTime: this.stats.totalSearchTime,
      cacheSize: this.cache.size
    };
  }

  /**
   * Reset search statistics
   */
  resetStatistics() {
    this.stats = {
      searches: 0,
      semanticSearches: 0,
      keywordSearches: 0,
      regexSearches: 0,
      hybridSearches: 0,
      lastSearchDuration: 0,
      totalSearchTime: 0
    };
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}