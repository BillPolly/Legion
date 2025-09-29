/**
 * GraphDatabaseHandle - Root handle for Neo4j graph database
 * 
 * Provides comprehensive Handle-based interface for graph operations with
 * query optimization, validation, and advanced graph database features.
 */

import { CypherQueryBuilder } from '../query/CypherQueryBuilder.js';
import { QueryValidator } from '../query/QueryValidator.js';
import { QueryOptimizer } from '../query/QueryOptimizer.js';

export class GraphDatabaseHandle {
  constructor(dataSource) {
    if (!dataSource) {
      throw new Error('DataSource is required for GraphDatabaseHandle');
    }
    
    this.dataSource = dataSource;
    this._type = 'GraphDatabase';
    
    // Initialize query infrastructure
    this.validator = new QueryValidator();
    this.optimizer = new QueryOptimizer(dataSource);
    
    // Cache for frequently accessed data
    this._cache = {
      labels: null,
      relationshipTypes: null,
      schema: null,
      stats: null,
      cacheTime: 0,
      cacheTTL: 60000 // 1 minute default TTL
    };
    
    // Subscription management
    this.subscriptions = new Map();
    this.subscriptionCounter = 0;
  }

  /**
   * Query builder - create a new CypherQueryBuilder
   */
  query() {
    return new CypherQueryBuilder(this.dataSource);
  }

  /**
   * Query nodes by label and properties with enhanced options
   */
  nodes(label, properties = {}, options = {}) {
    const { 
      limit = 100, 
      orderBy = null, 
      optimize = true,
      includeRelationships = false 
    } = options;
    
    // Build query using CypherQueryBuilder for better optimization
    const builder = this.query()
      .match(label ? `(n:${label})` : '(n)');
    
    // Add property filters
    Object.entries(properties).forEach(([key, value]) => {
      builder.where(`n.${key} = $${key}`);
    });
    
    // Add relationships if requested
    if (includeRelationships) {
      builder
        .optionalMatch('(n)-[r]-(m)')
        .return('n', 'collect({rel: r, node: m}) as relationships');
    } else {
      builder.return('n');
    }
    
    // Add ordering and limit
    if (orderBy) {
      builder.orderBy(orderBy);
    }
    builder.limit(limit);
    
    // Add parameters and execute
    builder._addParameters(properties);
    const result = builder.execute(this.dataSource, { optimize });
    
    // Check if result has records
    if (!result || !result.records) {
      return [];
    }
    
    // Return array of NodeHandles with enhanced data
    return result.records.map(record => {
      const node = record.n;
      const nodeHandle = this.dataSource.createNodeHandle(node.identity || node.id);
      
      // Add relationship data if requested
      if (includeRelationships && record.relationships) {
        nodeHandle._relationships = record.relationships;
      }
      
      return nodeHandle;
    });
  }

  /**
   * Query relationships with enhanced filtering and options
   */
  relationships(type, direction = 'both', options = {}) {
    const { 
      limit = 100, 
      properties = {}, 
      includeNodes = false,
      optimize = true 
    } = options;
    
    const builder = this.query();
    
    // Build relationship pattern based on direction
    let pattern;
    switch (direction) {
      case 'incoming':
        pattern = type ? `()<-[r:${type}]-()` : '()<-[r]-()';
        break;
      case 'outgoing':
        pattern = type ? `()-[r:${type}]->()` : '()-[r]->()';
        break;
      default:
        pattern = type ? `()-[r:${type}]-()` : '()-[r]-()';
    }
    
    builder.match(pattern);
    
    // Add property filters for relationships
    Object.entries(properties).forEach(([key, value]) => {
      builder.where(`r.${key} = $${key}`);
    });
    
    // Return nodes if requested
    if (includeNodes) {
      builder.return('r', 'startNode(r) as start', 'endNode(r) as end');
    } else {
      builder.return('r');
    }
    
    builder.limit(limit);
    builder._addParameters(properties);
    
    return builder.execute(this.dataSource, { optimize });
  }

  /**
   * Execute optimized Cypher query with validation
   */
  cypher(query, params = {}, options = {}) {
    const { 
      validate = true, 
      optimize = true, 
      mapResults = true,
      useCache = true 
    } = options;
    
    const querySpec = {
      type: 'cypher',
      query,
      params
    };
    
    if (validate) {
      const validation = this.validator.validateQuery(querySpec);
      if (!validation.valid) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.warn('[GraphDatabaseHandle] Query warnings:', validation.warnings);
      }
    }
    
    if (optimize) {
      return this.optimizer.executeOptimized(querySpec, {
        mapResults,
        useCache,
        optimize: true
      });
    }
    
    return this.dataSource.query(querySpec);
  }

  /**
   * Create a new node with validation and optimization
   */
  createNode(labels, properties = {}, options = {}) {
    const { validate = true, returnHandle = true } = options;
    
    if (!labels) {
      throw new Error('Labels are required for node creation');
    }
    
    const labelArray = Array.isArray(labels) ? labels : [labels];
    const labelString = labelArray.join(':');
    
    // Validate properties if requested
    if (validate && properties) {
      const propValidation = this.validator.validateParameters(properties);
      if (propValidation.errors.length > 0) {
        throw new Error(`Property validation failed: ${propValidation.errors.join(', ')}`);
      }
    }
    
    const query = `CREATE (n:${labelString} $props) RETURN n`;
    const result = this.cypher(query, { props: properties }, { optimize: false });
    
    // Clear caches that might be affected
    this._invalidateCache(['labels', 'schema', 'stats']);
    
    if (returnHandle && result && result.records && result.records.length > 0) {
      const node = result.records[0].n;
      if (node) {
        return this.dataSource.createNodeHandle(node.identity || node.id);
      }
    }
    
    return result;
  }

  /**
   * Create a relationship between two nodes
   */
  createRelationship(fromNodeId, toNodeId, relationshipType, properties = {}, options = {}) {
    const { validate = true, returnHandle = false } = options;
    
    if (!fromNodeId || !toNodeId || !relationshipType) {
      throw new Error('From node ID, to node ID, and relationship type are required');
    }
    
    // Validate properties if requested
    if (validate && properties) {
      const propValidation = this.validator.validateParameters(properties);
      if (propValidation.errors.length > 0) {
        throw new Error(`Property validation failed: ${propValidation.errors.join(', ')}`);
      }
    }
    
    const query = `
      MATCH (from), (to)
      WHERE id(from) = $fromId AND id(to) = $toId
      CREATE (from)-[r:${relationshipType} $props]->(to)
      RETURN r
    `;
    
    const result = this.cypher(query, { 
      fromId: fromNodeId, 
      toId: toNodeId, 
      props: properties 
    }, { optimize: false });
    
    // Clear caches that might be affected
    this._invalidateCache(['relationshipTypes', 'schema', 'stats']);
    
    if (returnHandle && result && result.records && result.records.length > 0) {
      const rel = result.records[0].r;
      if (rel) {
        return this.dataSource.createRelationshipHandle(rel.identity || rel.id);
      }
    }
    
    return result;
  }

  /**
   * Get database statistics with caching
   */
  stats(options = {}) {
    const { useCache = true, detailed = false } = options;
    
    if (useCache && this._isCacheValid('stats')) {
      return this._cache.stats;
    }
    
    let query;
    if (detailed) {
      query = `
        MATCH (n) 
        WITH count(n) as nodeCount, collect(distinct labels(n)) as labelGroups
        MATCH ()-[r]->()
        WITH nodeCount, labelGroups, count(r) as relCount, collect(distinct type(r)) as relTypes
        RETURN 
          nodeCount, 
          relCount,
          size(apoc.coll.flatten(labelGroups)) as labelCount,
          size(relTypes) as relTypeCount,
          labelGroups,
          relTypes
      `;
    } else {
      query = `
        MATCH (n) 
        WITH count(n) as nodeCount
        MATCH ()-[r]->()
        WITH nodeCount, count(r) as relCount
        RETURN nodeCount, relCount
      `;
    }
    
    const result = this.cypher(query, {}, { optimize: false });
    
    let stats;
    if (result.records.length > 0) {
      const record = result.records[0];
      stats = {
        nodes: record.nodeCount || 0,
        relationships: record.relCount || 0
      };
      
      if (detailed) {
        stats.labelCount = record.labelCount || 0;
        stats.relationshipTypeCount = record.relTypeCount || 0;
        stats.labels = record.labelGroups || [];
        stats.relationshipTypes = record.relTypes || [];
      }
    } else {
      stats = { nodes: 0, relationships: 0 };
      if (detailed) {
        stats.labelCount = 0;
        stats.relationshipTypeCount = 0;
        stats.labels = [];
        stats.relationshipTypes = [];
      }
    }
    
    // Cache the result
    this._cache.stats = stats;
    this._cache.cacheTime = Date.now();
    
    return stats;
  }

  /**
   * Get enhanced schema information with caching
   */
  async schema(options = {}) {
    const { useCache = true, detailed = true } = options;
    
    if (useCache && this._isCacheValid('schema')) {
      return this._cache.schema;
    }
    
    const schema = await this.dataSource.getSchemaAsync({
      useCache,
      forceRefresh: !useCache
    });
    
    // Cache the result
    this._cache.schema = schema;
    this._cache.cacheTime = Date.now();
    
    return detailed ? schema : {
      labels: schema.labels,
      relationships: schema.relationships,
      properties: schema.properties
    };
  }

  /**
   * Get all node labels with caching
   */
  labels(options = {}) {
    const { useCache = true } = options;
    
    if (useCache && this._isCacheValid('labels')) {
      return this._cache.labels;
    }
    
    const result = this.cypher('CALL db.labels() YIELD label RETURN collect(label) as labels');
    const labels = result.records[0]?.labels || [];
    
    // Cache the result
    this._cache.labels = labels;
    this._cache.cacheTime = Date.now();
    
    return labels;
  }

  /**
   * Get all relationship types with caching
   */
  relationshipTypes(options = {}) {
    const { useCache = true } = options;
    
    if (useCache && this._isCacheValid('relationshipTypes')) {
      return this._cache.relationshipTypes;
    }
    
    const result = this.cypher('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types');
    const types = result.records[0]?.types || [];
    
    // Cache the result
    this._cache.relationshipTypes = types;
    this._cache.cacheTime = Date.now();
    
    return types;
  }

  /**
   * Subscribe to database changes with enhanced filtering
   */
  subscribe(pattern, callback, options = {}) {
    const { 
      labels = null, 
      relationshipTypes = null, 
      operations = ['create', 'update', 'delete'] 
    } = options;
    
    const subscriptionId = ++this.subscriptionCounter;
    
    // Create enhanced subscription specification
    const subscriptionSpec = {
      type: pattern.type || '*',
      labels: labels,
      relationshipTypes: relationshipTypes,
      operations: operations,
      originalPattern: pattern
    };
    
    const unsubscribe = this.dataSource.subscribe(subscriptionSpec, (event) => {
      // Filter events based on subscription options
      if (this._matchesSubscription(event, subscriptionSpec)) {
        callback(event);
      }
    });
    
    this.subscriptions.set(subscriptionId, unsubscribe);
    
    // Return enhanced unsubscribe function
    return () => {
      const unsub = this.subscriptions.get(subscriptionId);
      if (unsub) {
        unsub();
        this.subscriptions.delete(subscriptionId);
      }
    };
  }

  /**
   * Batch operations for performance
   */
  batch(operations, options = {}) {
    const { validate = true, optimize = true, transactional = false } = options;
    
    if (transactional) {
      throw new Error('Transactional batch operations require Phase 9 implementation');
    }
    
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'createNode':
            result = this.createNode(operation.labels, operation.properties, { validate });
            break;
          case 'createRelationship':
            result = this.createRelationship(
              operation.fromNodeId, 
              operation.toNodeId, 
              operation.relationshipType, 
              operation.properties, 
              { validate }
            );
            break;
          case 'cypher':
            result = this.cypher(operation.query, operation.params, { validate, optimize });
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        
        results.push({ success: true, result, operation });
      } catch (error) {
        results.push({ success: false, error: error.message, operation });
      }
    }
    
    return {
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
      totalCount: results.length
    };
  }

  /**
   * Begin a transaction (returns TransactionHandle)
   */
  transaction() {
    // Will be implemented in Phase 9
    throw new Error('Transactions not yet implemented - will be available in Phase 9');
  }

  /**
   * Get query performance recommendations
   */
  async getPerformanceRecommendations(query, params = {}) {
    return await this.optimizer.getPerformanceRecommendations({
      type: 'cypher',
      query,
      params
    });
  }

  /**
   * Clear all data (use with extreme caution!)
   */
  clear(options = {}) {
    const { confirm = false } = options;
    
    if (!confirm) {
      throw new Error('Clear operation requires explicit confirmation: { confirm: true }');
    }
    
    console.warn('[GraphDatabaseHandle] Clearing all data from database');
    
    const result = this.cypher('MATCH (n) DETACH DELETE n', {}, { optimize: false });
    
    // Clear all caches
    this._invalidateAllCache();
    
    return result;
  }

  /**
   * Cache management methods
   */
  setCacheTTL(ttl) {
    this._cache.cacheTTL = ttl;
  }

  clearCache(cacheType = null) {
    if (cacheType) {
      this._invalidateCache([cacheType]);
    } else {
      this._invalidateAllCache();
    }
  }

  getCacheInfo() {
    const now = Date.now();
    const age = now - this._cache.cacheTime;
    
    return {
      cached: this._cache.cacheTime > 0,
      age: age,
      ttl: this._cache.cacheTTL,
      valid: age < this._cache.cacheTTL,
      cacheTypes: {
        labels: !!this._cache.labels,
        relationshipTypes: !!this._cache.relationshipTypes,
        schema: !!this._cache.schema,
        stats: !!this._cache.stats
      }
    };
  }

  /**
   * Private helper methods
   */
  _isCacheValid(cacheType) {
    if (!this._cache[cacheType] || this._cache.cacheTime === 0) {
      return false;
    }
    
    const now = Date.now();
    const age = now - this._cache.cacheTime;
    return age < this._cache.cacheTTL;
  }

  _invalidateCache(cacheTypes) {
    for (const type of cacheTypes) {
      this._cache[type] = null;
    }
    this._cache.cacheTime = 0;
  }

  _invalidateAllCache() {
    this._cache.labels = null;
    this._cache.relationshipTypes = null;
    this._cache.schema = null;
    this._cache.stats = null;
    this._cache.cacheTime = 0;
  }

  _matchesSubscription(event, subscriptionSpec) {
    // Check operation type
    if (subscriptionSpec.operations && 
        !subscriptionSpec.operations.includes(event.type)) {
      return false;
    }
    
    // Check labels if specified
    if (subscriptionSpec.labels && event.data?.labels) {
      const hasMatchingLabel = subscriptionSpec.labels.some(label =>
        event.data.labels.includes(label)
      );
      if (!hasMatchingLabel) {
        return false;
      }
    }
    
    // Check relationship types if specified
    if (subscriptionSpec.relationshipTypes && event.data?.type) {
      if (!subscriptionSpec.relationshipTypes.includes(event.data.type)) {
        return false;
      }
    }
    
    return true;
  }
}