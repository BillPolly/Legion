/**
 * QueryOptimizer - Query optimization and result mapping for Neo4j queries
 * 
 * Provides:
 * - Query performance analysis
 * - Result set transformation and mapping
 * - Execution plan optimization recommendations
 * - Memory usage optimization
 */

export class QueryOptimizer {
  constructor(dataSource = null) {
    this.dataSource = dataSource;
    this.optimizationRules = new Map();
    this.resultMappers = new Map();
    this.executionCache = new Map();
    this.cacheMaxSize = 100;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    this._initializeOptimizationRules();
    this._initializeResultMappers();
  }
  
  /**
   * Optimize a query for better performance
   */
  optimizeQuery(querySpec, options = {}) {
    const {
      enableCaching = true,
      enableIndexHints = true,
      enableLimitOptimization = true,
      enablePatternOptimization = true
    } = options;
    
    let optimizedQuery = { ...querySpec };
    const optimizations = [];
    
    // Apply optimization rules
    for (const [ruleName, rule] of this.optimizationRules) {
      if (this._shouldApplyRule(ruleName, options)) {
        const result = rule(optimizedQuery);
        if (result.optimized) {
          optimizedQuery = result.query;
          optimizations.push({
            rule: ruleName,
            description: result.description,
            impact: result.impact || 'unknown'
          });
        }
      }
    }
    
    return {
      originalQuery: querySpec,
      optimizedQuery,
      optimizations,
      estimatedImprovement: this._calculateEstimatedImprovement(optimizations)
    };
  }
  
  /**
   * Execute query with result mapping and optimization
   */
  async executeOptimized(querySpec, options = {}) {
    if (!this.dataSource) {
      throw new Error('DataSource is required for query execution');
    }
    
    const {
      mapResults = true,
      useCache = true,
      resultMapper = 'default',
      optimize = true
    } = options;
    
    let finalQuery = querySpec;
    
    // Optimize query if requested
    if (optimize) {
      const optimization = this.optimizeQuery(querySpec, options);
      finalQuery = optimization.optimizedQuery;
      
      if (optimization.optimizations.length > 0) {
        console.log(`[QueryOptimizer] Applied ${optimization.optimizations.length} optimizations`);
        optimization.optimizations.forEach(opt => {
          console.log(`  - ${opt.rule}: ${opt.description}`);
        });
      }
    }
    
    // Check execution cache
    const cacheKey = this._generateCacheKey(finalQuery);
    if (useCache && this.executionCache.has(cacheKey)) {
      this.cacheStats.hits++;
      console.log('[QueryOptimizer] Cache hit for query');
      return this.executionCache.get(cacheKey);
    }
    
    // Execute query
    this.cacheStats.misses++;
    const startTime = Date.now();
    const rawResult = await this.dataSource.queryAsync(finalQuery, options);
    const executionTime = Date.now() - startTime;
    
    // Map results if requested
    let finalResult = rawResult;
    if (mapResults && this.resultMappers.has(resultMapper)) {
      const mapper = this.resultMappers.get(resultMapper);
      finalResult = this._mapResults(rawResult, mapper, finalQuery);
    }
    
    // Add execution metadata
    const result = {
      ...finalResult,
      _metadata: {
        executionTime,
        optimized: optimize,
        cached: false,
        recordCount: finalResult.records?.length || 0,
        query: finalQuery.query
      }
    };
    
    // Cache result if beneficial
    if (useCache && this._shouldCacheResult(finalQuery, result, executionTime)) {
      this._addToCache(cacheKey, result);
    }
    
    return result;
  }
  
  /**
   * Analyze query execution plan
   */
  async analyzeExecutionPlan(querySpec) {
    if (!this.dataSource) {
      throw new Error('DataSource is required for execution plan analysis');
    }
    
    const explainQuery = {
      type: 'cypher',
      query: `EXPLAIN ${querySpec.query}`,
      params: querySpec.params || {}
    };
    
    try {
      const explainResult = await this.dataSource.queryAsync(explainQuery);
      return this._parseExecutionPlan(explainResult);
    } catch (error) {
      console.warn('[QueryOptimizer] Could not analyze execution plan:', error.message);
      return {
        available: false,
        error: error.message,
        recommendations: []
      };
    }
  }
  
  /**
   * Get performance recommendations for a query
   */
  async getPerformanceRecommendations(querySpec) {
    const recommendations = [];
    
    // Static analysis recommendations
    const staticRecommendations = this._analyzeStaticPerformance(querySpec);
    recommendations.push(...staticRecommendations);
    
    // Execution plan recommendations (if DataSource available)
    if (this.dataSource) {
      try {
        const planAnalysis = await this.analyzeExecutionPlan(querySpec);
        if (planAnalysis.available) {
          recommendations.push(...planAnalysis.recommendations);
        }
      } catch (error) {
        // Ignore execution plan analysis errors
      }
    }
    
    return {
      query: querySpec.query,
      recommendations: recommendations,
      priority: this._prioritizeRecommendations(recommendations),
      estimatedImpact: this._estimateRecommendationImpact(recommendations)
    };
  }
  
  /**
   * Transform result set using custom mapping functions
   */
  transformResults(results, transformSpec) {
    if (!results || !results.records) {
      return results;
    }
    
    const transformedRecords = results.records.map(record => {
      let transformedRecord = { ...record };
      
      // Apply field mappings
      if (transformSpec.fieldMappings) {
        transformedRecord = this._applyFieldMappings(transformedRecord, transformSpec.fieldMappings);
      }
      
      // Apply data type conversions
      if (transformSpec.typeConversions) {
        transformedRecord = this._applyTypeConversions(transformedRecord, transformSpec.typeConversions);
      }
      
      // Apply custom transformations
      if (transformSpec.customTransforms) {
        for (const transform of transformSpec.customTransforms) {
          transformedRecord = transform(transformedRecord);
        }
      }
      
      return transformedRecord;
    });
    
    return {
      ...results,
      records: transformedRecords,
      _transformed: true,
      _transformSpec: transformSpec
    };
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      cacheSize: this.executionCache.size,
      hitRatio: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
  
  /**
   * Clear execution cache
   */
  clearCache() {
    const previousSize = this.executionCache.size;
    this.executionCache.clear();
    console.log(`[QueryOptimizer] Cleared cache (${previousSize} entries)`);
  }
  
  /**
   * Private methods for optimization rules
   */
  _initializeOptimizationRules() {
    // Rule: Add LIMIT to unbounded queries
    this.optimizationRules.set('addLimit', (querySpec) => {
      const query = querySpec.query?.toUpperCase() || '';
      
      if (query.includes('MATCH') && 
          query.includes('RETURN') && 
          !query.includes('LIMIT') && 
          !query.includes('COUNT') &&
          !query.includes('COLLECT')) {
        
        return {
          optimized: true,
          query: {
            ...querySpec,
            query: querySpec.query + '\nLIMIT 1000'
          },
          description: 'Added default LIMIT to prevent large result sets',
          impact: 'high'
        };
      }
      
      return { optimized: false };
    });
    
    // Rule: Optimize WHERE clause order
    this.optimizationRules.set('optimizeWhere', (querySpec) => {
      const query = querySpec.query || '';
      
      // Look for WHERE clauses that could be reordered for better performance
      const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+RETURN|\s+ORDER|\s+LIMIT|$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1].split(/\s+AND\s+/i);
        
        if (conditions.length > 1) {
          // Sort conditions by selectivity (simple heuristic)
          const optimizedConditions = conditions.sort((a, b) => {
            const aScore = this._getConditionSelectivityScore(a);
            const bScore = this._getConditionSelectivityScore(b);
            return bScore - aScore; // Higher selectivity first
          });
          
          if (JSON.stringify(conditions) !== JSON.stringify(optimizedConditions)) {
            const optimizedWhere = optimizedConditions.join(' AND ');
            const optimizedQuery = query.replace(whereMatch[1], optimizedWhere);
            
            return {
              optimized: true,
              query: {
                ...querySpec,
                query: optimizedQuery
              },
              description: 'Reordered WHERE conditions for better selectivity',
              impact: 'medium'
            };
          }
        }
      }
      
      return { optimized: false };
    });
    
    // Rule: Convert EXISTS to more efficient patterns
    this.optimizationRules.set('optimizeExists', (querySpec) => {
      const query = querySpec.query || '';
      
      // Look for EXISTS patterns that could be optimized
      if (query.includes('EXISTS')) {
        // This is a simplified example - real implementation would be more sophisticated
        const optimizedQuery = query.replace(
          /WHERE\s+EXISTS\s*\(\s*\(([^)]+)\)-\[([^\]]*)\]->\(([^)]+)\)\s*\)/gi,
          'WHERE size(($1)-[$2]->($3)) > 0'
        );
        
        if (optimizedQuery !== query) {
          return {
            optimized: true,
            query: {
              ...querySpec,
              query: optimizedQuery
            },
            description: 'Converted EXISTS to size() pattern for better performance',
            impact: 'medium'
          };
        }
      }
      
      return { optimized: false };
    });
  }
  
  /**
   * Initialize result mappers
   */
  _initializeResultMappers() {
    // Default mapper - flatten Neo4j objects
    this.resultMappers.set('default', {
      name: 'default',
      description: 'Default Neo4j result flattening',
      mapRecord: (record) => {
        const mapped = {};
        for (const [key, value] of Object.entries(record)) {
          mapped[key] = this._flattenNeo4jValue(value);
        }
        return mapped;
      }
    });
    
    // Graph mapper - preserve graph structure
    this.resultMappers.set('graph', {
      name: 'graph',
      description: 'Preserve graph structure with nodes and relationships',
      mapRecord: (record) => {
        const mapped = {
          nodes: [],
          relationships: [],
          data: {}
        };
        
        for (const [key, value] of Object.entries(record)) {
          if (this._isNeo4jNode(value)) {
            mapped.nodes.push(this._convertNeo4jNode(value));
          } else if (this._isNeo4jRelationship(value)) {
            mapped.relationships.push(this._convertNeo4jRelationship(value));
          } else {
            mapped.data[key] = this._flattenNeo4jValue(value);
          }
        }
        
        return mapped;
      }
    });
    
    // Minimal mapper - only include specified fields
    this.resultMappers.set('minimal', {
      name: 'minimal',
      description: 'Include only essential fields to minimize memory usage',
      mapRecord: (record, fields = []) => {
        const mapped = {};
        
        if (fields.length === 0) {
          // If no fields specified, include all but flatten deeply nested structures
          for (const [key, value] of Object.entries(record)) {
            mapped[key] = this._simplifyValue(value);
          }
        } else {
          // Include only specified fields
          for (const field of fields) {
            if (field in record) {
              mapped[field] = this._simplifyValue(record[field]);
            }
          }
        }
        
        return mapped;
      }
    });
  }
  
  /**
   * Helper methods
   */
  _shouldApplyRule(ruleName, options) {
    // Check if specific rule is disabled
    const ruleOption = `enable${ruleName.charAt(0).toUpperCase()}${ruleName.slice(1)}`;
    return options[ruleOption] !== false;
  }
  
  _calculateEstimatedImprovement(optimizations) {
    let totalImpact = 0;
    const impactWeights = { high: 3, medium: 2, low: 1 };
    
    for (const opt of optimizations) {
      totalImpact += impactWeights[opt.impact] || 1;
    }
    
    return Math.min(totalImpact * 0.1, 0.8); // Cap at 80% improvement
  }
  
  _generateCacheKey(querySpec) {
    return JSON.stringify({
      query: querySpec.query,
      params: querySpec.params || {},
      type: querySpec.type
    });
  }
  
  _shouldCacheResult(querySpec, result, executionTime) {
    // Cache if execution took more than 100ms and result is not too large
    return executionTime > 100 && 
           JSON.stringify(result).length < 50000 && 
           !querySpec.query?.toUpperCase().includes('CREATE');
  }
  
  _addToCache(key, result) {
    if (this.executionCache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.executionCache.keys().next().value;
      this.executionCache.delete(firstKey);
      this.cacheStats.evictions++;
    }
    
    // Add timestamp for cache expiry
    const cachedResult = {
      ...result,
      _cached: true,
      _cacheTime: Date.now()
    };
    
    if (cachedResult._metadata) {
      cachedResult._metadata.cached = true;
    }
    
    this.executionCache.set(key, cachedResult);
  }
  
  _mapResults(results, mapper, querySpec) {
    if (!results || !results.records) {
      return results;
    }
    
    const mappedRecords = results.records.map(record => {
      return mapper.mapRecord(record, querySpec);
    });
    
    return {
      ...results,
      records: mappedRecords,
      _mapped: true,
      _mapper: mapper.name
    };
  }
  
  _parseExecutionPlan(explainResult) {
    // This is a simplified implementation
    // Real implementation would parse Neo4j execution plans
    return {
      available: true,
      plan: explainResult,
      recommendations: [
        'Consider adding indexes on frequently filtered properties',
        'Use LIMIT to bound result sets',
        'Consider using WITH clauses to pipeline operations'
      ]
    };
  }
  
  _analyzeStaticPerformance(querySpec) {
    const recommendations = [];
    const query = querySpec.query?.toUpperCase() || '';
    
    if (query.includes('MATCH') && !query.includes('LIMIT') && !query.includes('COUNT')) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: 'Consider adding LIMIT to prevent large result sets',
        suggestion: 'Add LIMIT clause to bound query results'
      });
    }
    
    if (query.includes('WHERE') && !query.includes('INDEX')) {
      recommendations.push({
        type: 'optimization',
        severity: 'low',
        message: 'Consider adding indexes on filtered properties',
        suggestion: 'Create indexes on properties used in WHERE clauses'
      });
    }
    
    if ((query.match(/MATCH/g) || []).length > 1 && !query.includes('WHERE')) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: 'Multiple MATCH clauses without WHERE may create cartesian products',
        suggestion: 'Add WHERE clauses to connect MATCH patterns'
      });
    }
    
    return recommendations;
  }
  
  _prioritizeRecommendations(recommendations) {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return recommendations.sort((a, b) => {
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }
  
  _estimateRecommendationImpact(recommendations) {
    const impactScores = { high: 30, medium: 15, low: 5 };
    let totalImpact = 0;
    
    for (const rec of recommendations) {
      totalImpact += impactScores[rec.severity] || 0;
    }
    
    return Math.min(totalImpact, 70); // Cap at 70% improvement
  }
  
  _getConditionSelectivityScore(condition) {
    // Simple heuristic for condition selectivity
    if (condition.includes('=')) return 10; // Equality is highly selective
    if (condition.includes('IN')) return 8;
    if (condition.includes('>') || condition.includes('<')) return 6;
    if (condition.includes('CONTAINS')) return 4;
    if (condition.includes('STARTS WITH')) return 5;
    return 1; // Default low selectivity
  }
  
  _applyFieldMappings(record, mappings) {
    const mapped = {};
    for (const [sourceField, targetField] of Object.entries(mappings)) {
      if (sourceField in record) {
        mapped[targetField] = record[sourceField];
      }
    }
    return mapped;
  }
  
  _applyTypeConversions(record, conversions) {
    const converted = { ...record };
    for (const [field, converter] of Object.entries(conversions)) {
      if (field in converted && typeof converter === 'function') {
        converted[field] = converter(converted[field]);
      }
    }
    return converted;
  }
  
  _flattenNeo4jValue(value) {
    if (!value) return value;
    
    // Handle Neo4j Integer
    if (value && typeof value === 'object' && value.toNumber) {
      return value.toNumber();
    }
    
    // Handle Neo4j Node
    if (value.labels && value.properties) {
      return {
        id: value.identity?.toString(),
        labels: value.labels,
        properties: value.properties
      };
    }
    
    // Handle Neo4j Relationship
    if (value.type && value.start && value.end) {
      return {
        id: value.identity?.toString(),
        type: value.type,
        start: value.start?.toString(),
        end: value.end?.toString(),
        properties: value.properties
      };
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this._flattenNeo4jValue(v));
    }
    
    return value;
  }
  
  _isNeo4jNode(value) {
    return value && value.labels && value.properties;
  }
  
  _isNeo4jRelationship(value) {
    return value && value.type && value.start && value.end;
  }
  
  _convertNeo4jNode(node) {
    return {
      id: node.identity?.toString(),
      labels: node.labels,
      properties: node.properties
    };
  }
  
  _convertNeo4jRelationship(rel) {
    return {
      id: rel.identity?.toString(),
      type: rel.type,
      start: rel.start?.toString(),
      end: rel.end?.toString(),
      properties: rel.properties
    };
  }
  
  _simplifyValue(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    
    // For complex objects, only include essential fields
    if (Array.isArray(value)) {
      return value.map(v => this._simplifyValue(v));
    }
    
    // For Neo4j objects, include only core data
    if (value.labels) {
      return { id: value.identity?.toString(), labels: value.labels };
    }
    
    if (value.type && value.start && value.end) {
      return { 
        id: value.identity?.toString(), 
        type: value.type,
        start: value.start?.toString(),
        end: value.end?.toString()
      };
    }
    
    return value;
  }
}