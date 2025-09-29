/**
 * Neo4jDataSource - DataSource implementation for Neo4j graph database
 * 
 * Provides both async and sync interfaces for Neo4j operations.
 * The async interface is preferred; sync is provided for Actor pattern compatibility.
 */

import { GraphDatabaseHandle } from '../handles/GraphDatabaseHandle.js';
import { NodeHandle } from '../handles/NodeHandle.js';
import { QueryValidator } from '../query/QueryValidator.js';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Neo4jDataSource {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.neo4jHandle = null;
    this.initialized = false;
    this.subscriptions = new Map();
    this.subscriptionCounter = 0;
    this.validator = new QueryValidator();
    
    // Schema caching with TTL
    this.schemaCache = {
      data: null,
      timestamp: 0,
      ttl: 5 * 60 * 1000, // 5 minutes default TTL
      version: 0
    };
    
    // Schema evolution tracking
    this.schemaHistory = [];
    this.maxHistorySize = 10;
  }

  /**
   * Initialize the DataSource with Neo4j connection
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Get Neo4j handle from ResourceManager
    this.neo4jHandle = await this.resourceManager.getNeo4jServer();
    this.initialized = true;
    console.log('[Neo4jDataSource] Initialized');
  }

  /**
   * Execute a query asynchronously (preferred)
   */
  async queryAsync(querySpec, options = {}) {
    if (!this.initialized) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }
    
    const { validate = true, throwOnWarnings = false } = options;
    
    // Validate query if requested
    if (validate) {
      const validation = this.validator.validateQuery(querySpec);
      
      if (validation.errors.length > 0) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (throwOnWarnings && validation.warnings.length > 0) {
        throw new Error(`Query validation warnings: ${validation.warnings.join(', ')}`);
      }
      
      // Log warnings if present
      if (validation.warnings.length > 0) {
        console.warn('[Neo4jDataSource] Query warnings:', validation.warnings);
      }
    }
    
    switch (querySpec.type) {
      case 'cypher':
        return await this._executeCypherQuery(querySpec);
      case 'node':
        return await this._executeNodeQuery(querySpec);
      case 'relationship':
        return await this._executeRelationshipQuery(querySpec);
      default:
        throw new Error(`Unsupported query type: ${querySpec.type}`);
    }
  }

  /**
   * Execute a query synchronously (for Handle compatibility)
   * Uses message passing to ResourceManager for async operations
   */
  query(querySpec) {
    if (!this.initialized) {
      throw new Error('DataSource not initialized. Call initialize() first.');
    }
    
    // Use ResourceManager to handle async operation synchronously via message passing
    return this.resourceManager.query({
      dataSource: 'neo4j',
      querySpec: querySpec,
      handler: this
    });
  }

  /**
   * Execute Cypher query
   */
  async _executeCypherQuery(querySpec) {
    try {
      const result = await this.neo4jHandle.run(querySpec.query, querySpec.params || {});
      
      // Transform Neo4j result to simpler format
      const transformedResult = {
        records: result.records.map(record => {
          const obj = {};
          record.keys.forEach(key => {
            const value = record.get(key);
            obj[key] = this._convertNeo4jValue(value);
          });
          return obj;
        }),
        summary: result.summary
      };
      
      // Trigger subscriptions if this was a write operation
      if (this._isWriteQuery(querySpec.query)) {
        setImmediate(() => this._triggerSubscriptions(querySpec, transformedResult));
        
        // Invalidate schema cache if this might change the schema
        if (this._isSchemaChangingQuery(querySpec.query)) {
          this.invalidateSchemaCache();
        }
      }
      
      return transformedResult;
    } catch (error) {
      console.error('[Neo4jDataSource] Query error:', error.message);
      throw error;
    }
  }

  /**
   * Execute node query
   */
  async _executeNodeQuery(querySpec) {
    const labels = querySpec.labels ? ':' + querySpec.labels.join(':') : '';
    const whereClause = this._buildWhereClause(querySpec.properties);
    const query = `MATCH (n${labels}) ${whereClause} RETURN n`;
    
    return await this._executeCypherQuery({
      type: 'cypher',
      query,
      params: querySpec.properties || {}
    });
  }

  /**
   * Execute relationship query
   */
  async _executeRelationshipQuery(querySpec) {
    const relType = querySpec.relationshipType ? ':' + querySpec.relationshipType : '';
    let pattern = '';
    
    switch (querySpec.direction) {
      case 'incoming':
        pattern = `()<-[r${relType}]-()`;
        break;
      case 'outgoing':
        pattern = `()-[r${relType}]->()`;
        break;
      default:
        pattern = `()-[r${relType}]-()`;
    }
    
    const query = `MATCH ${pattern} RETURN r`;
    return await this._executeCypherQuery({ type: 'cypher', query });
  }

  /**
   * Get schema information synchronously (for Handle compatibility)
   */
  getSchema() {
    return this.resourceManager.query({
      dataSource: 'neo4j',
      querySpec: { type: 'schema' },
      handler: this
    });
  }

  /**
   * Get enhanced schema information asynchronously with caching
   */
  async getSchemaAsync(options = {}) {
    if (!this.initialized) {
      throw new Error('DataSource not initialized');
    }
    
    const { 
      useCache = true, 
      ttl = this.schemaCache.ttl,
      forceRefresh = false 
    } = options;
    
    // Check cache validity
    if (useCache && !forceRefresh && this._isCacheValid()) {
      console.log('[Neo4jDataSource] Returning cached schema');
      return this.schemaCache.data;
    }
    
    console.log('[Neo4jDataSource] Building enhanced schema...');
    
    const schema = {
      labels: [],
      relationships: [],
      properties: {},
      propertyTypes: {},
      indexes: [],
      constraints: [],
      relationshipCardinality: {},
      statistics: {}
    };
    
    // Get labels
    const labelResult = await this._executeCypherQuery({
      type: 'cypher',
      query: 'CALL db.labels() YIELD label RETURN collect(label) as labels'
    });
    schema.labels = labelResult.records[0]?.labels || [];
    
    // Get relationship types
    const relResult = await this._executeCypherQuery({
      type: 'cypher',
      query: 'CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types'
    });
    schema.relationships = relResult.records[0]?.types || [];
    
    // Get indexes
    try {
      const indexResult = await this._executeCypherQuery({
        type: 'cypher',
        query: 'SHOW INDEXES YIELD name, type, labelsOrTypes, properties, state RETURN collect({name: name, type: type, labels: labelsOrTypes, properties: properties, state: state}) as indexes'
      });
      schema.indexes = indexResult.records[0]?.indexes || [];
    } catch (error) {
      console.log('[Neo4jDataSource] SHOW INDEXES not supported, using fallback');
      schema.indexes = [];
    }
    
    // Get constraints
    try {
      const constraintResult = await this._executeCypherQuery({
        type: 'cypher',
        query: 'SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties, options RETURN collect({name: name, type: type, labels: labelsOrTypes, properties: properties, options: options}) as constraints'
      });
      schema.constraints = constraintResult.records[0]?.constraints || [];
    } catch (error) {
      console.log('[Neo4jDataSource] SHOW CONSTRAINTS not supported, using fallback');
      schema.constraints = [];
    }
    
    // Get detailed property information for each label
    for (const label of schema.labels) {
      console.log(`[Neo4jDataSource] Analyzing properties for label: ${label}`);
      
      // Get property names
      const propResult = await this._executeCypherQuery({
        type: 'cypher',
        query: `MATCH (n:${label}) RETURN keys(n) as properties LIMIT 100`
      });
      
      const allProperties = new Set();
      propResult.records.forEach(record => {
        if (record.properties) {
          record.properties.forEach(prop => allProperties.add(prop));
        }
      });
      schema.properties[label] = Array.from(allProperties);
      
      // Get property types by sampling (try APOC first, fall back to basic detection)
      const propertyTypes = {};
      for (const prop of allProperties) {
        let typeDetected = false;
        
        // Try APOC first
        try {
          const apocTypeResult = await this._executeCypherQuery({
            type: 'cypher',
            query: `
              MATCH (n:${label}) 
              WHERE n.${prop} IS NOT NULL 
              RETURN 
                apoc.meta.type(n.${prop}) as type,
                count(*) as count
              ORDER BY count DESC 
              LIMIT 5
            `
          });
          
          if (apocTypeResult.records.length > 0) {
            propertyTypes[prop] = {
              primaryType: apocTypeResult.records[0].type,
              typeDistribution: apocTypeResult.records.map(r => ({
                type: r.type,
                count: r.count
              }))
            };
            typeDetected = true;
          }
        } catch (error) {
          // APOC not available, will use fallback
        }
        
        // Fallback for basic type detection without APOC
        if (!typeDetected) {
          try {
            const basicTypeResult = await this._executeCypherQuery({
              type: 'cypher',
              query: `
                MATCH (n:${label}) 
                WHERE n.${prop} IS NOT NULL 
                WITH n.${prop} as value
                RETURN 
                  CASE 
                    WHEN value IS NULL THEN 'null'
                    WHEN toString(value) =~ '^-?[0-9]+$' THEN 'integer'
                    WHEN toString(value) =~ '^-?[0-9]*\\.[0-9]+$' THEN 'float'
                    WHEN toString(value) IN ['true', 'false'] THEN 'boolean'
                    WHEN size(toString(value)) > 0 THEN 'string'
                    ELSE 'unknown'
                  END as type,
                  count(*) as count
                ORDER BY count DESC 
                LIMIT 5
              `
            });
            
            if (basicTypeResult.records.length > 0) {
              propertyTypes[prop] = {
                primaryType: basicTypeResult.records[0].type,
                typeDistribution: basicTypeResult.records.map(r => ({
                  type: r.type,
                  count: r.count
                }))
              };
            }
          } catch (error) {
            // Even basic type detection failed, use minimal info
            propertyTypes[prop] = {
              primaryType: 'unknown',
              typeDistribution: [{ type: 'unknown', count: 0 }]
            };
          }
        }
      }
      schema.propertyTypes[label] = propertyTypes;
    }
    
    // Get relationship cardinality analysis
    for (const relType of schema.relationships) {
      const cardinalityResult = await this._executeCypherQuery({
        type: 'cypher',
        query: `
          MATCH ()-[r:${relType}]->()
          WITH 
            count(r) as total,
            count(DISTINCT startNode(r)) as uniqueStarts,
            count(DISTINCT endNode(r)) as uniqueEnds
          RETURN 
            total,
            uniqueStarts,
            uniqueEnds,
            CASE 
              WHEN total = uniqueStarts AND total = uniqueEnds THEN 'one-to-one'
              WHEN total = uniqueStarts THEN 'one-to-many'  
              WHEN total = uniqueEnds THEN 'many-to-one'
              ELSE 'many-to-many'
            END as cardinality
        `
      });
      
      if (cardinalityResult.records.length > 0) {
        const record = cardinalityResult.records[0];
        schema.relationshipCardinality[relType] = {
          total: record.total,
          uniqueStarts: record.uniqueStarts,
          uniqueEnds: record.uniqueEnds,
          cardinality: record.cardinality
        };
      }
    }
    
    // Get database statistics
    const statsResult = await this._executeCypherQuery({
      type: 'cypher',
      query: `
        MATCH (n) 
        WITH count(n) as nodeCount
        MATCH ()-[r]->()
        WITH nodeCount, count(r) as relCount
        RETURN nodeCount, relCount
      `
    });
    
    if (statsResult.records.length > 0) {
      schema.statistics = {
        nodeCount: statsResult.records[0].nodeCount,
        relationshipCount: statsResult.records[0].relCount,
        labelCount: schema.labels.length,
        relationshipTypeCount: schema.relationships.length
      };
    }
    
    // Cache the schema with metadata
    this._cacheSchema(schema, ttl);
    
    console.log(`[Neo4jDataSource] Enhanced schema complete: ${schema.labels.length} labels, ${schema.relationships.length} relationship types`);
    return schema;
  }

  /**
   * Subscribe to changes
   */
  subscribe(querySpec, callback) {
    const subscriptionId = ++this.subscriptionCounter;
    
    this.subscriptions.set(subscriptionId, {
      querySpec,
      callback
    });
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Create root GraphDatabaseHandle
   */
  createHandle() {
    return new GraphDatabaseHandle(this);
  }

  /**
   * Create NodeHandle for specific node
   */
  createNodeHandle(nodeId) {
    return new NodeHandle(this, nodeId);
  }

  /**
   * Convert Neo4j values to plain JavaScript
   */
  _convertNeo4jValue(value) {
    if (!value) return value;
    
    // Handle Neo4j Integer
    if (value && typeof value === 'object' && value.toNumber) {
      return value.toNumber();
    }
    
    // Handle Neo4j Node
    if (value.labels && value.properties) {
      return {
        identity: value.identity?.toString(),
        labels: value.labels,
        properties: this._convertProperties(value.properties)
      };
    }
    
    // Handle Neo4j Relationship
    if (value.type && value.start && value.end) {
      return {
        identity: value.identity?.toString(),
        type: value.type,
        start: value.start?.toString(),
        end: value.end?.toString(),
        properties: this._convertProperties(value.properties)
      };
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this._convertNeo4jValue(v));
    }
    
    // Handle objects (might have nested Neo4j Integers)
    if (value && typeof value === 'object') {
      return this._convertProperties(value);
    }
    
    return value;
  }
  
  /**
   * Convert properties object, handling Neo4j Integers
   */
  _convertProperties(properties) {
    if (!properties) return properties;
    
    const converted = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === 'object' && value.toNumber) {
        converted[key] = value.toNumber();
      } else if (Array.isArray(value)) {
        converted[key] = value.map(v => this._convertNeo4jValue(v));
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  /**
   * Build WHERE clause from properties
   */
  _buildWhereClause(properties) {
    if (!properties || Object.keys(properties).length === 0) {
      return '';
    }
    
    const conditions = Object.keys(properties).map(key => `n.${key} = $${key}`);
    return 'WHERE ' + conditions.join(' AND ');
  }

  /**
   * Check if query is a write operation
   */
  _isWriteQuery(query) {
    const writeKeywords = ['CREATE', 'DELETE', 'SET', 'REMOVE', 'MERGE'];
    const upperQuery = query.toUpperCase();
    return writeKeywords.some(keyword => upperQuery.includes(keyword));
  }

  /**
   * Check if query might change the schema (new labels, constraints, indexes)
   */
  _isSchemaChangingQuery(query) {
    const upperQuery = query.toUpperCase();
    
    // Detect creation of new node labels
    if (upperQuery.includes('CREATE') && upperQuery.includes(':')) {
      return true;
    }
    
    // Detect index/constraint operations
    if (upperQuery.includes('CREATE INDEX') || 
        upperQuery.includes('DROP INDEX') ||
        upperQuery.includes('CREATE CONSTRAINT') ||
        upperQuery.includes('DROP CONSTRAINT')) {
      return true;
    }
    
    // Detect SET operations that might add new properties
    if (upperQuery.includes('SET') && upperQuery.includes('.')) {
      return true;
    }
    
    return false;
  }

  /**
   * Trigger relevant subscriptions
   */
  _triggerSubscriptions(querySpec, result) {
    this.subscriptions.forEach(subscription => {
      if (this._matchesSubscription(querySpec, subscription.querySpec)) {
        subscription.callback({
          type: this._getOperationType(querySpec.query),
          data: result.records[0],
          querySpec
        });
      }
    });
  }

  /**
   * Check if query matches subscription
   */
  _matchesSubscription(querySpec, subscriptionSpec) {
    if (subscriptionSpec.type !== querySpec.type && subscriptionSpec.type !== '*') {
      return false;
    }
    
    // Check labels if specified
    if (subscriptionSpec.labels && querySpec.type === 'node') {
      return subscriptionSpec.labels.some(label => 
        querySpec.labels?.includes(label)
      );
    }
    
    return true;
  }

  /**
   * Get operation type from query
   */
  _getOperationType(query) {
    const upperQuery = query.toUpperCase();
    if (upperQuery.includes('CREATE')) return 'create';
    if (upperQuery.includes('DELETE')) return 'delete';
    if (upperQuery.includes('SET') || upperQuery.includes('MERGE')) return 'update';
    return 'read';
  }

  /**
   * Cache management methods
   */
  _isCacheValid() {
    if (!this.schemaCache.data) {
      return false;
    }
    
    const now = Date.now();
    const cacheAge = now - this.schemaCache.timestamp;
    return cacheAge < this.schemaCache.ttl;
  }

  _cacheSchema(schema, ttl) {
    const newVersion = this.schemaCache.version + 1;
    
    // Track schema evolution
    this._trackSchemaEvolution(schema, newVersion);
    
    this.schemaCache = {
      data: schema,
      timestamp: Date.now(),
      ttl: ttl || this.schemaCache.ttl,
      version: newVersion
    };
    
    console.log(`[Neo4jDataSource] Schema cached (version ${this.schemaCache.version}, TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate schema cache
   */
  invalidateSchemaCache() {
    console.log('[Neo4jDataSource] Invalidating schema cache');
    this.schemaCache.data = null;
    this.schemaCache.timestamp = 0;
  }

  /**
   * Get schema cache info
   */
  getSchemaCacheInfo() {
    const now = Date.now();
    const age = this.schemaCache.timestamp > 0 ? now - this.schemaCache.timestamp : 0;
    
    return {
      cached: !!this.schemaCache.data,
      version: this.schemaCache.version,
      age: age,
      ttl: this.schemaCache.ttl,
      valid: this._isCacheValid(),
      expiresIn: this._isCacheValid() ? this.schemaCache.ttl - age : 0
    };
  }

  /**
   * Set schema cache TTL
   */
  setSchemaCacheTTL(ttl) {
    this.schemaCache.ttl = ttl;
    console.log(`[Neo4jDataSource] Schema cache TTL set to ${ttl}ms`);
  }

  /**
   * Schema evolution tracking methods
   */
  _trackSchemaEvolution(schema, version) {
    const previousSchema = this.schemaCache.data;
    if (!previousSchema) {
      // First schema - create initial entry
      this.schemaHistory.push({
        version: version,
        timestamp: Date.now(),
        type: 'initial',
        changes: {
          labels: { added: schema.labels, removed: [] },
          relationships: { added: schema.relationships, removed: [] },
          properties: this._buildPropertyChanges({}, schema.properties)
        },
        summary: `Initial schema: ${schema.labels.length} labels, ${schema.relationships.length} relationships`
      });
      return;
    }
    
    // Detect changes between previous and current schema
    const changes = this._detectSchemaChanges(previousSchema, schema);
    
    if (changes.hasChanges) {
      const historyEntry = {
        version: version,
        timestamp: Date.now(),
        type: 'evolution',
        changes: changes,
        summary: this._generateChangeSummary(changes)
      };
      
      this.schemaHistory.push(historyEntry);
      
      // Maintain history size limit
      if (this.schemaHistory.length > this.maxHistorySize) {
        this.schemaHistory.shift();
      }
      
      console.log(`[Neo4jDataSource] Schema evolution detected: ${historyEntry.summary}`);
    }
  }

  _detectSchemaChanges(previousSchema, currentSchema) {
    const changes = {
      hasChanges: false,
      labels: this._detectArrayChanges(previousSchema.labels, currentSchema.labels),
      relationships: this._detectArrayChanges(previousSchema.relationships, currentSchema.relationships),
      properties: this._detectPropertyChanges(previousSchema.properties, currentSchema.properties),
      indexes: this._detectIndexChanges(previousSchema.indexes, currentSchema.indexes),
      constraints: this._detectConstraintChanges(previousSchema.constraints, currentSchema.constraints)
    };
    
    // Check if any changes occurred
    changes.hasChanges = changes.labels.added.length > 0 || 
                        changes.labels.removed.length > 0 ||
                        changes.relationships.added.length > 0 || 
                        changes.relationships.removed.length > 0 ||
                        Object.keys(changes.properties).length > 0 ||
                        changes.indexes.added.length > 0 || 
                        changes.indexes.removed.length > 0 ||
                        changes.constraints.added.length > 0 || 
                        changes.constraints.removed.length > 0;
    
    return changes;
  }

  _detectArrayChanges(previousArray, currentArray) {
    const prev = new Set(previousArray || []);
    const curr = new Set(currentArray || []);
    
    return {
      added: [...curr].filter(x => !prev.has(x)),
      removed: [...prev].filter(x => !curr.has(x))
    };
  }

  _detectPropertyChanges(previousProps, currentProps) {
    const changes = {};
    
    // Check for new labels with properties
    for (const [label, props] of Object.entries(currentProps || {})) {
      if (!previousProps[label]) {
        changes[label] = {
          type: 'label_added',
          properties: props
        };
      } else {
        const propChanges = this._detectArrayChanges(previousProps[label], props);
        if (propChanges.added.length > 0 || propChanges.removed.length > 0) {
          changes[label] = {
            type: 'properties_changed',
            added: propChanges.added,
            removed: propChanges.removed
          };
        }
      }
    }
    
    // Check for removed labels
    for (const label of Object.keys(previousProps || {})) {
      if (!currentProps[label]) {
        changes[label] = {
          type: 'label_removed'
        };
      }
    }
    
    return changes;
  }

  _detectIndexChanges(previousIndexes, currentIndexes) {
    const prevNames = new Set((previousIndexes || []).map(idx => idx.name));
    const currNames = new Set((currentIndexes || []).map(idx => idx.name));
    
    return {
      added: (currentIndexes || []).filter(idx => !prevNames.has(idx.name)),
      removed: (previousIndexes || []).filter(idx => !currNames.has(idx.name))
    };
  }

  _detectConstraintChanges(previousConstraints, currentConstraints) {
    const prevNames = new Set((previousConstraints || []).map(con => con.name));
    const currNames = new Set((currentConstraints || []).map(con => con.name));
    
    return {
      added: (currentConstraints || []).filter(con => !prevNames.has(con.name)),
      removed: (previousConstraints || []).filter(con => !currNames.has(con.name))
    };
  }

  _buildPropertyChanges(previousProps, currentProps) {
    const changes = {};
    for (const [label, props] of Object.entries(currentProps || {})) {
      changes[label] = {
        type: 'initial',
        properties: props
      };
    }
    return changes;
  }

  _generateChangeSummary(changes) {
    const parts = [];
    
    if (changes.labels.added.length > 0) {
      parts.push(`+${changes.labels.added.length} labels (${changes.labels.added.join(', ')})`);
    }
    if (changes.labels.removed.length > 0) {
      parts.push(`-${changes.labels.removed.length} labels (${changes.labels.removed.join(', ')})`);
    }
    if (changes.relationships.added.length > 0) {
      parts.push(`+${changes.relationships.added.length} relationships (${changes.relationships.added.join(', ')})`);
    }
    if (changes.relationships.removed.length > 0) {
      parts.push(`-${changes.relationships.removed.length} relationships (${changes.relationships.removed.join(', ')})`);
    }
    
    const propChangeCount = Object.keys(changes.properties).length;
    if (propChangeCount > 0) {
      parts.push(`${propChangeCount} property changes`);
    }
    
    if (changes.indexes.added.length > 0) {
      parts.push(`+${changes.indexes.added.length} indexes`);
    }
    if (changes.indexes.removed.length > 0) {
      parts.push(`-${changes.indexes.removed.length} indexes`);
    }
    
    if (changes.constraints.added.length > 0) {
      parts.push(`+${changes.constraints.added.length} constraints`);
    }
    if (changes.constraints.removed.length > 0) {
      parts.push(`-${changes.constraints.removed.length} constraints`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No significant changes';
  }

  /**
   * Get schema evolution history
   */
  getSchemaHistory() {
    return this.schemaHistory.map(entry => ({
      version: entry.version,
      timestamp: entry.timestamp,
      type: entry.type,
      summary: entry.summary,
      age: Date.now() - entry.timestamp
    }));
  }

  /**
   * Get detailed schema changes for a specific version
   */
  getSchemaChanges(version) {
    const entry = this.schemaHistory.find(h => h.version === version);
    return entry ? entry.changes : null;
  }

  /**
   * Detect breaking changes in schema evolution
   */
  detectBreakingChanges(changes) {
    const breaking = [];
    
    // Removed labels or relationships are breaking
    if (changes.labels?.removed.length > 0) {
      breaking.push(`Removed labels: ${changes.labels.removed.join(', ')}`);
    }
    if (changes.relationships?.removed.length > 0) {
      breaking.push(`Removed relationships: ${changes.relationships.removed.join(', ')}`);
    }
    
    // Removed properties are breaking
    for (const [label, propChanges] of Object.entries(changes.properties || {})) {
      if (propChanges.type === 'label_removed') {
        breaking.push(`Removed label: ${label}`);
      } else if (propChanges.removed?.length > 0) {
        breaking.push(`Removed properties from ${label}: ${propChanges.removed.join(', ')}`);
      }
    }
    
    // Removed constraints might be breaking
    if (changes.constraints?.removed.length > 0) {
      breaking.push(`Removed constraints: ${changes.constraints.removed.map(c => c.name).join(', ')}`);
    }
    
    return breaking;
  }
}