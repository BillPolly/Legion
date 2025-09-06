import { LRUCache } from './CacheLayer.js';

/**
 * Query optimizer for storage operations
 * Provides query planning, result caching, and performance optimization
 */
export class QueryOptimizer {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.enabled = options.enabled !== false;
    this.cacheSize = options.cacheSize || 500;
    this.cacheTTL = options.cacheTTL || 600000; // 10 minutes
    this.enableQueryPlanning = options.enableQueryPlanning !== false;
    this.enableResultCaching = options.enableResultCaching !== false;
    this.enableStatistics = options.enableStatistics !== false;
    
    // Query result cache
    this.resultCache = new LRUCache(this.cacheSize, this.cacheTTL);
    
    // Query statistics for optimization
    this.queryStats = new Map();
    this.executionTimes = new Map();
    
    // Query patterns for optimization
    this.commonPatterns = new Set();
    this.expensivePatterns = new Set();
    
    // Performance thresholds
    this.slowQueryThreshold = options.slowQueryThreshold || 1000; // 1 second
    this.frequentQueryThreshold = options.frequentQueryThreshold || 10;
  }

  /**
   * Get metadata including optimizer stats
   */
  getMetadata() {
    const baseMetadata = this.storage.getMetadata();
    return {
      ...baseMetadata,
      optimized: true,
      optimizerEnabled: this.enabled,
      optimizerStats: this.getOptimizerStats()
    };
  }

  /**
   * Optimized query execution
   */
  async query(subject, predicate, object) {
    if (!this.enabled) {
      return await this.storage.query(subject, predicate, object);
    }
    
    const queryKey = this._getQueryKey(subject, predicate, object);
    const startTime = Date.now();
    
    try {
      // Check result cache first
      if (this.enableResultCaching) {
        const cached = this.resultCache.get(queryKey);
        if (cached !== undefined) {
          this._recordCacheHit(queryKey);
          return cached;
        }
      }
      
      // Apply query planning optimization
      const optimizedQuery = this.enableQueryPlanning 
        ? this._optimizeQuery(subject, predicate, object)
        : { subject, predicate, object };
      
      // Execute the query
      const result = await this.storage.query(
        optimizedQuery.subject, 
        optimizedQuery.predicate, 
        optimizedQuery.object
      );
      
      // Cache the result
      if (this.enableResultCaching) {
        this.resultCache.set(queryKey, result);
      }
      
      // Record statistics
      const executionTime = Date.now() - startTime;
      this._recordQueryExecution(queryKey, executionTime, result.length);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._recordQueryError(queryKey, executionTime, error);
      throw error;
    }
  }

  /**
   * Optimized batch query execution
   */
  async batchQuery(queries) {
    if (!this.enabled || !Array.isArray(queries)) {
      // Fallback to individual queries
      const results = [];
      for (const [s, p, o] of queries) {
        results.push(await this.query(s, p, o));
      }
      return results;
    }
    
    const startTime = Date.now();
    
    try {
      // Group queries by pattern for optimization
      const groupedQueries = this._groupQueriesByPattern(queries);
      const results = [];
      
      for (const [pattern, patternQueries] of groupedQueries) {
        if (patternQueries.length === 1) {
          // Single query - use normal optimization
          const [s, p, o] = patternQueries[0];
          results.push(await this.query(s, p, o));
        } else {
          // Multiple queries with same pattern - optimize as batch
          const batchResults = await this._executeBatchPattern(pattern, patternQueries);
          results.push(...batchResults);
        }
      }
      
      const executionTime = Date.now() - startTime;
      this._recordBatchExecution(queries.length, executionTime);
      
      return results;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._recordBatchError(queries.length, executionTime, error);
      throw error;
    }
  }

  /**
   * Analyze query patterns and suggest optimizations
   */
  analyzeQueryPatterns() {
    if (!this.enableStatistics) {
      return { message: 'Statistics collection is disabled' };
    }
    
    const analysis = {
      totalQueries: 0,
      uniquePatterns: this.queryStats.size,
      commonPatterns: [],
      expensivePatterns: [],
      recommendations: []
    };
    
    // Analyze query statistics
    for (const [pattern, stats] of this.queryStats.entries()) {
      analysis.totalQueries += stats.count;
      
      // Identify common patterns
      if (stats.count >= this.frequentQueryThreshold) {
        analysis.commonPatterns.push({
          pattern,
          count: stats.count,
          avgTime: stats.totalTime / stats.count,
          avgResults: stats.totalResults / stats.count
        });
      }
      
      // Identify expensive patterns
      const avgTime = stats.totalTime / stats.count;
      if (avgTime >= this.slowQueryThreshold) {
        analysis.expensivePatterns.push({
          pattern,
          count: stats.count,
          avgTime,
          totalTime: stats.totalTime
        });
      }
    }
    
    // Sort by frequency and cost
    analysis.commonPatterns.sort((a, b) => b.count - a.count);
    analysis.expensivePatterns.sort((a, b) => b.avgTime - a.avgTime);
    
    // Generate recommendations
    analysis.recommendations = this._generateRecommendations(analysis);
    
    return analysis;
  }

  /**
   * Warm up caches with common query patterns
   */
  async warmupCache(patterns = null) {
    if (!this.enabled || !this.enableResultCaching) {
      return { message: 'Caching is disabled' };
    }
    
    const patternsToWarm = patterns || this._getCommonPatterns();
    const results = {
      attempted: patternsToWarm.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const [s, p, o] of patternsToWarm) {
      try {
        await this.query(s, p, o);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          pattern: [s, p, o],
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Clear optimizer caches and reset statistics
   */
  reset() {
    this.resultCache.clear();
    this.queryStats.clear();
    this.executionTimes.clear();
    this.commonPatterns.clear();
    this.expensivePatterns.clear();
  }

  /**
   * Get comprehensive optimizer statistics
   */
  getOptimizerStats() {
    if (!this.enabled) {
      return { enabled: false };
    }
    
    const cacheStats = this.resultCache.getStats();
    const queryCount = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
    
    return {
      enabled: true,
      resultCache: cacheStats,
      queryStatistics: {
        totalQueries: queryCount,
        uniquePatterns: this.queryStats.size,
        commonPatterns: this.commonPatterns.size,
        expensivePatterns: this.expensivePatterns.size
      },
      performance: this._getPerformanceMetrics()
    };
  }

  /**
   * Pass through other storage methods
   */
  async addTriple(subject, predicate, object) {
    const result = await this.storage.addTriple(subject, predicate, object);
    if (result && this.enabled) {
      this._invalidateCacheForTriple(subject, predicate, object);
    }
    return result;
  }

  async removeTriple(subject, predicate, object) {
    const result = await this.storage.removeTriple(subject, predicate, object);
    if (result && this.enabled) {
      this._invalidateCacheForTriple(subject, predicate, object);
    }
    return result;
  }

  async size() {
    return await this.storage.size();
  }

  async clear() {
    const result = await this.storage.clear();
    if (this.enabled) {
      this.reset();
    }
    return result;
  }

  async exists(subject, predicate, object) {
    return await this.storage.exists(subject, predicate, object);
  }

  async addTriples(triples) {
    const result = await this.storage.addTriples(triples);
    if (result > 0 && this.enabled) {
      for (const [s, p, o] of triples) {
        this._invalidateCacheForTriple(s, p, o);
      }
    }
    return result;
  }

  async removeTriples(triples) {
    const result = await this.storage.removeTriples(triples);
    if (result > 0 && this.enabled) {
      for (const [s, p, o] of triples) {
        this._invalidateCacheForTriple(s, p, o);
      }
    }
    return result;
  }

  async beginTransaction() {
    if (this.storage.beginTransaction) {
      return await this.storage.beginTransaction();
    }
    throw new Error('Transactions not supported by underlying storage');
  }

  async close() {
    if (this.storage.close) {
      await this.storage.close();
    }
    if (this.enabled) {
      this.reset();
    }
  }

  // Private methods

  /**
   * Generate query key for caching and statistics
   */
  _getQueryKey(subject, predicate, object) {
    return `${subject || '*'}|${predicate || '*'}|${JSON.stringify(object) || '*'}`;
  }

  /**
   * Optimize query based on patterns and statistics
   */
  _optimizeQuery(subject, predicate, object) {
    const queryKey = this._getQueryKey(subject, predicate, object);
    
    // Check if this is a known expensive pattern
    if (this.expensivePatterns.has(queryKey)) {
      // Apply specific optimizations for expensive queries
      return this._optimizeExpensiveQuery(subject, predicate, object);
    }
    
    // Apply general optimizations
    return this._applyGeneralOptimizations(subject, predicate, object);
  }

  /**
   * Apply optimizations for expensive queries
   */
  _optimizeExpensiveQuery(subject, predicate, object) {
    // For expensive queries, try to make them more specific
    // This is a simplified optimization - real implementation would be more sophisticated
    
    if (subject === null && predicate === null && object === null) {
      // Very broad query - try to limit scope
      // Could add LIMIT clause or break into smaller queries
      return { subject, predicate, object, limit: 1000 };
    }
    
    return { subject, predicate, object };
  }

  /**
   * Apply general query optimizations
   */
  _applyGeneralOptimizations(subject, predicate, object) {
    // Reorder query parameters for optimal index usage
    // This would depend on the underlying storage's indexing strategy
    
    // For now, just return as-is
    return { subject, predicate, object };
  }

  /**
   * Group queries by pattern for batch optimization
   */
  _groupQueriesByPattern(queries) {
    const groups = new Map();
    
    for (const query of queries) {
      const [s, p, o] = query;
      const pattern = this._getQueryPattern(s, p, o);
      
      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern).push(query);
    }
    
    return groups;
  }

  /**
   * Get query pattern for grouping
   */
  _getQueryPattern(subject, predicate, object) {
    const s = subject === null || subject === undefined ? '*' : 'S';
    const p = predicate === null || predicate === undefined ? '*' : 'P';
    const o = object === null || object === undefined ? '*' : 'O';
    return `${s}-${p}-${o}`;
  }

  /**
   * Execute batch of queries with same pattern
   */
  async _executeBatchPattern(pattern, queries) {
    // For now, execute individually
    // Real implementation could optimize based on storage capabilities
    const results = [];
    for (const [s, p, o] of queries) {
      results.push(await this.storage.query(s, p, o));
    }
    return results;
  }

  /**
   * Record query execution statistics
   */
  _recordQueryExecution(queryKey, executionTime, resultCount) {
    if (!this.enableStatistics) return;
    
    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        count: 0,
        totalTime: 0,
        totalResults: 0,
        errors: 0,
        lastExecuted: Date.now()
      });
    }
    
    const stats = this.queryStats.get(queryKey);
    stats.count++;
    stats.totalTime += executionTime;
    stats.totalResults += resultCount;
    stats.lastExecuted = Date.now();
    
    // Track patterns
    if (stats.count >= this.frequentQueryThreshold) {
      this.commonPatterns.add(queryKey);
    }
    
    if (executionTime >= this.slowQueryThreshold) {
      this.expensivePatterns.add(queryKey);
    }
  }

  /**
   * Record query error
   */
  _recordQueryError(queryKey, executionTime, error) {
    if (!this.enableStatistics) return;
    
    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        count: 0,
        totalTime: 0,
        totalResults: 0,
        errors: 0,
        lastExecuted: Date.now()
      });
    }
    
    const stats = this.queryStats.get(queryKey);
    stats.errors++;
    stats.lastExecuted = Date.now();
  }

  /**
   * Record cache hit
   */
  _recordCacheHit(queryKey) {
    // Cache hit is already tracked by LRUCache
    // Could add additional tracking here if needed
  }

  /**
   * Record batch execution
   */
  _recordBatchExecution(queryCount, executionTime) {
    if (!this.enableStatistics) return;
    
    // Track batch statistics
    if (!this.queryStats.has('__batch__')) {
      this.queryStats.set('__batch__', {
        count: 0,
        totalTime: 0,
        totalQueries: 0,
        errors: 0
      });
    }
    
    const stats = this.queryStats.get('__batch__');
    stats.count++;
    stats.totalTime += executionTime;
    stats.totalQueries += queryCount;
  }

  /**
   * Record batch error
   */
  _recordBatchError(queryCount, executionTime, error) {
    if (!this.enableStatistics) return;
    
    if (!this.queryStats.has('__batch__')) {
      this.queryStats.set('__batch__', {
        count: 0,
        totalTime: 0,
        totalQueries: 0,
        errors: 0
      });
    }
    
    const stats = this.queryStats.get('__batch__');
    stats.errors++;
  }

  /**
   * Invalidate cache entries for a triple
   */
  _invalidateCacheForTriple(subject, predicate, object) {
    if (!this.enableResultCaching) return;
    
    const keysToRemove = [];
    
    for (const key of this.resultCache.keys()) {
      if (this._cacheKeyMatches(key, subject, predicate, object)) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.resultCache.delete(key);
    }
  }

  /**
   * Check if cache key matches triple pattern
   */
  _cacheKeyMatches(cacheKey, subject, predicate, object) {
    const [s, p, o] = cacheKey.split('|');
    
    return (s === '*' || s === subject) &&
           (p === '*' || p === predicate) &&
           (o === '*' || o === JSON.stringify(object));
  }

  /**
   * Get common query patterns for cache warming
   */
  _getCommonPatterns() {
    return Array.from(this.commonPatterns).map(pattern => {
      const [s, p, o] = pattern.split('|');
      return [
        s === '*' ? null : s,
        p === '*' ? null : p,
        o === '*' ? null : JSON.parse(o)
      ];
    });
  }

  /**
   * Generate optimization recommendations
   */
  _generateRecommendations(analysis) {
    const recommendations = [];
    
    // Recommend caching for frequent queries
    if (analysis.commonPatterns.length > 0) {
      recommendations.push({
        type: 'caching',
        priority: 'high',
        message: `Consider increasing cache size for ${analysis.commonPatterns.length} frequent query patterns`,
        patterns: analysis.commonPatterns.slice(0, 5)
      });
    }
    
    // Recommend optimization for expensive queries
    if (analysis.expensivePatterns.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `${analysis.expensivePatterns.length} query patterns are slow and need optimization`,
        patterns: analysis.expensivePatterns.slice(0, 3)
      });
    }
    
    // Recommend indexing if many unique patterns
    if (analysis.uniquePatterns > 100) {
      recommendations.push({
        type: 'indexing',
        priority: 'medium',
        message: `Consider adding indexes for ${analysis.uniquePatterns} unique query patterns`
      });
    }
    
    return recommendations;
  }

  /**
   * Get performance metrics
   */
  _getPerformanceMetrics() {
    if (!this.enableStatistics) {
      return { available: false };
    }
    
    const allStats = Array.from(this.queryStats.values());
    const totalQueries = allStats.reduce((sum, stats) => sum + stats.count, 0);
    const totalTime = allStats.reduce((sum, stats) => sum + stats.totalTime, 0);
    
    return {
      available: true,
      averageQueryTime: totalQueries > 0 ? totalTime / totalQueries : 0,
      slowQueries: this.expensivePatterns.size,
      frequentQueries: this.commonPatterns.size,
      cacheHitRate: this.resultCache.getStats().hitRate
    };
  }
}

/**
 * Factory function to wrap storage with query optimization
 */
export function withOptimization(storage, options = {}) {
  return new QueryOptimizer(storage, options);
}
