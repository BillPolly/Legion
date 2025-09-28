/**
 * DataStoreQueryBuilder - Concrete implementation of query builder for DataStore DataSource
 * 
 * Demonstrates how to implement the DataSource.queryBuilder() method
 * for a specific resource type (DataScript/DataStore). This is the "Layer 2"
 * implementation that provides resource-specific query building logic.
 * 
 * Key features:
 * - Analyzes source Handle type to determine appropriate projections
 * - Creates new Handle proxies through projection pattern
 * - Handles type-aware query operations (collection, entity, stream, scalar)
 * - Maintains operation chains for complex queries
 * - Provides terminal methods that execute queries and return appropriate Handle types
 */

import { CollectionProxy } from '../src/CollectionProxy.js';
import { StreamProxy } from '../src/StreamProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';
import { PrototypeFactory } from '../../handle/src/PrototypeFactory.js';

/**
 * DataStore-specific query builder implementation
 * 
 * This query builder understands DataScript query semantics and can create
 * appropriate Handle projections based on the source Handle type and operations.
 */
class DataStoreQueryBuilder {
  constructor(dataSource, sourceHandle) {
    this.dataSource = dataSource;
    this.sourceHandle = sourceHandle;
    this.operations = [];
    
    // Cache for prototype factory
    this._prototypeFactory = null;
    
    // Analyze source Handle to determine capabilities
    this.sourceType = this._analyzeSourceType(sourceHandle);
    this.sourceSchema = this._extractSourceSchema(sourceHandle);
  }
  
  /**
   * Add filter operation to query chain
   * @param {Function} predicate - Filter predicate function
   * @returns {DataStoreQueryBuilder} New query builder with filter applied
   */
  where(predicate) {
    return this._addOperation('where', predicate);
  }
  
  /**
   * Add transformation operation to query chain
   * @param {Function} mapper - Transformation function
   * @returns {DataStoreQueryBuilder} New query builder with transformation applied
   */
  select(mapper) {
    return this._addOperation('select', mapper);
  }
  
  /**
   * Add join operation to query chain
   * @param {Handle} otherHandle - Handle to join with
   * @param {Function|string} joinCondition - Join condition
   * @returns {DataStoreQueryBuilder} New query builder with join applied
   */
  join(otherHandle, joinCondition) {
    return this._addOperation('join', otherHandle, joinCondition);
  }
  
  /**
   * Add ordering operation to query chain
   * @param {Function|string} orderBy - Order function or attribute name
   * @param {string} direction - 'asc' or 'desc'
   * @returns {DataStoreQueryBuilder} New query builder with ordering applied
   */
  orderBy(orderBy, direction = 'asc') {
    return this._addOperation('orderBy', orderBy, direction);
  }
  
  /**
   * Add limit operation to query chain
   * @param {number} count - Maximum number of results
   * @returns {DataStoreQueryBuilder} New query builder with limit applied
   */
  limit(count) {
    return this._addOperation('limit', count);
  }
  
  /**
   * Add skip operation to query chain
   * @param {number} count - Number of results to skip
   * @returns {DataStoreQueryBuilder} New query builder with offset applied
   */
  skip(count) {
    return this._addOperation('skip', count);
  }
  
  /**
   * Add grouping operation to query chain
   * @param {Function|string} groupBy - Group function or attribute name
   * @returns {DataStoreQueryBuilder} New query builder with grouping applied
   */
  groupBy(groupBy) {
    return this._addOperation('groupBy', groupBy);
  }
  
  /**
   * Add aggregation operation to query chain
   * @param {Function|string} aggregateFunction - Aggregation function
   * @param {string} field - Field to aggregate
   * @returns {DataStoreQueryBuilder} New query builder with aggregation applied
   */
  aggregate(aggregateFunction, field) {
    return this._addOperation('aggregate', aggregateFunction, field);
  }
  
  // Terminal methods that execute the query and return appropriate Handle types
  
  /**
   * Get first result as appropriate Handle type
   * @returns {Handle|null} EntityProxy, scalar value, or null
   */
  first() {
    const querySpec = this._buildQuerySpec();
    const results = this.dataSource.query(querySpec);
    
    if (!results || results.length === 0) {
      return null;
    }
    
    const firstResult = results[0];
    return this._createResultHandle(firstResult, 'entity');
  }
  
  /**
   * Get last result as appropriate Handle type
   * @returns {Handle|null} EntityProxy, scalar value, or null
   */
  last() {
    const querySpec = this._buildQuerySpec();
    const results = this.dataSource.query(querySpec);
    
    if (!results || results.length === 0) {
      return null;
    }
    
    const lastResult = results[results.length - 1];
    return this._createResultHandle(lastResult, 'entity');
  }
  
  /**
   * Count results
   * @returns {number} Number of results
   */
  count() {
    // For count operations, modify query to count results efficiently
    const querySpec = this._buildQuerySpec();
    
    // Check if this is already an aggregation operation
    const hasAggregation = this.operations.some(op => op.type === 'aggregate');
    if (hasAggregation) {
      const results = this.dataSource.query(querySpec);
      return Array.isArray(results) ? results.length : (typeof results === 'number' ? results : 0);
    }
    
    // For regular queries, just count results
    const results = this.dataSource.query(querySpec);
    return Array.isArray(results) ? results.length : 0;
  }
  
  /**
   * Execute query and return results as array
   * @returns {Array} Array of results
   */
  toArray() {
    const querySpec = this._buildQuerySpec();
    const results = this.dataSource.query(querySpec);
    
    // Apply post-query operations that can't be done in DataScript
    return this._applyPostQueryOperations(results);
  }
  
  // Private methods for building and executing queries
  
  /**
   * Add operation to chain and return new query builder
   * @private
   */
  _addOperation(type, ...args) {
    const newBuilder = new DataStoreQueryBuilder(this.dataSource, this.sourceHandle);
    newBuilder.operations = [...this.operations, { type, args }];
    newBuilder.sourceType = this.sourceType;
    newBuilder.sourceSchema = this.sourceSchema;
    return newBuilder;
  }
  
  /**
   * Analyze source Handle type to determine query capabilities
   * @private
   */
  _analyzeSourceType(handle) {
    if (handle instanceof CollectionProxy) {
      return {
        type: 'collection',
        entityType: this._extractEntityType(handle),
        canFilter: true,
        canJoin: true,
        canAggregate: true,
        canGroup: true
      };
    } else if (handle instanceof StreamProxy) {
      return {
        type: 'stream',
        entityType: 'event', // Streams typically contain events
        canFilter: true,
        canJoin: true,
        canAggregate: true,
        canGroup: false // Streams don't typically support grouping
      };
    } else if (handle instanceof EntityProxy) {
      return {
        type: 'entity',
        entityType: handle.entityType || 'unknown',
        canFilter: false, // Single entity can't be filtered
        canJoin: true, // Can join with collections
        canAggregate: false,
        canGroup: false
      };
    } else {
      return {
        type: 'unknown',
        entityType: 'unknown',
        canFilter: false,
        canJoin: false,
        canAggregate: false,
        canGroup: false
      };
    }
  }
  
  /**
   * Extract entity type from Handle
   * @private
   */
  _extractEntityType(handle) {
    if (handle.collectionSpec && handle.collectionSpec.where) {
      // Look for entity type in where clause
      for (const pattern of handle.collectionSpec.where) {
        if (Array.isArray(pattern) && pattern.length === 3) {
          const [entity, attr, value] = pattern;
          if (attr === ':entity/type' && typeof value === 'string') {
            return value;
          }
        }
      }
    }
    return 'unknown';
  }
  
  /**
   * Extract schema information from source Handle
   * @private
   */
  _extractSourceSchema(handle) {
    try {
      return this.dataSource.getSchema();
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Build DataScript query specification from operations
   * @private
   */
  _buildQuerySpec() {
    let querySpec;
    
    // Start with source Handle's query specification
    if (this.sourceHandle.collectionSpec) {
      querySpec = { ...this.sourceHandle.collectionSpec };
    } else if (this.sourceHandle.querySpec) {
      querySpec = { ...this.sourceHandle.querySpec };
    } else {
      // Create basic query for entity
      querySpec = {
        find: ['?e', '?attr', '?value'],
        where: [[this.sourceHandle.entityId, '?attr', '?value']]
      };
    }
    
    // Apply operations that can be done in DataScript
    for (const operation of this.operations) {
      querySpec = this._applyOperationToQuery(querySpec, operation);
    }
    
    return querySpec;
  }
  
  /**
   * Apply single operation to DataScript query specification
   * @private
   */
  _applyOperationToQuery(querySpec, operation) {
    const { type, args } = operation;
    
    switch (type) {
      case 'where':
        return this._applyWhereToQuery(querySpec, args[0]);
      
      case 'orderBy':
        return this._applyOrderByToQuery(querySpec, args[0], args[1]);
      
      case 'limit':
        return this._applyLimitToQuery(querySpec, args[0]);
      
      case 'join':
        return this._applyJoinToQuery(querySpec, args[0], args[1]);
      
      default:
        // Operations that can't be done in DataScript will be applied post-query
        return querySpec;
    }
  }
  
  /**
   * Apply where filter to DataScript query
   * @private
   */
  _applyWhereToQuery(querySpec, predicate) {
    // For simple attribute-based filters, we can add to DataScript where clause
    // For complex predicates, they'll be applied post-query
    
    // This is simplified - real implementation would analyze predicate
    // and convert to DataScript where patterns when possible
    return querySpec;
  }
  
  /**
   * Apply ordering to DataScript query
   * @private
   */
  _applyOrderByToQuery(querySpec, orderBy, direction) {
    // DataScript doesn't have built-in ordering, so this will be applied post-query
    return querySpec;
  }
  
  /**
   * Apply limit to DataScript query
   * @private
   */
  _applyLimitToQuery(querySpec, count) {
    // DataScript doesn't have built-in limit, so this will be applied post-query
    return querySpec;
  }
  
  /**
   * Apply join to DataScript query
   * @private
   */
  _applyJoinToQuery(querySpec, otherHandle, joinCondition) {
    // For simple joins, we can modify the DataScript query
    // For complex joins, they'll be applied post-query
    
    if (typeof joinCondition === 'string') {
      // Simple attribute-based join
      const joinAttr = joinCondition;
      
      // Add join patterns to where clause
      const newWhere = [
        ...querySpec.where,
        ['?e1', `:${this.sourceType.entityType}/${joinAttr}`, '?joinValue'],
        ['?e2', `:${otherHandle.entityType}/${joinAttr}`, '?joinValue']
      ];
      
      return {
        ...querySpec,
        find: [...querySpec.find, '?e2'],
        where: newWhere
      };
    }
    
    // Complex joins will be applied post-query
    return querySpec;
  }
  
  /**
   * Apply operations that couldn't be done in DataScript
   * @private
   */
  _applyPostQueryOperations(results) {
    let processedResults = results;
    
    for (const operation of this.operations) {
      processedResults = this._applyPostQueryOperation(processedResults, operation);
    }
    
    return processedResults;
  }
  
  /**
   * Apply single post-query operation
   * @private
   */
  _applyPostQueryOperation(results, operation) {
    const { type, args } = operation;
    
    switch (type) {
      case 'where':
        return this._applyPostWhereFilter(results, args[0]);
      
      case 'select':
        return this._applyPostSelectTransform(results, args[0]);
      
      case 'orderBy':
        return this._applyPostOrderBy(results, args[0], args[1]);
      
      case 'limit':
        return results.slice(0, args[0]);
      
      case 'skip':
        return results.slice(args[0]);
      
      case 'groupBy':
        return this._applyPostGroupBy(results, args[0]);
      
      case 'aggregate':
        return this._applyPostAggregate(results, args[0], args[1]);
      
      default:
        return results;
    }
  }
  
  /**
   * Apply post-query where filter
   * @private
   */
  _applyPostWhereFilter(results, predicate) {
    return results.filter(result => {
      // Convert DataScript result to entity object for predicate
      const entity = this._convertResultToEntity(result);
      return predicate(entity);
    });
  }
  
  /**
   * Apply post-query select transformation
   * @private
   */
  _applyPostSelectTransform(results, mapper) {
    return results.map(result => {
      // Convert DataScript result to entity object for mapper
      const entity = this._convertResultToEntity(result);
      return mapper(entity);
    });
  }
  
  /**
   * Apply post-query ordering
   * @private
   */
  _applyPostOrderBy(results, orderBy, direction) {
    const sortedResults = [...results];
    
    sortedResults.sort((a, b) => {
      const entityA = this._convertResultToEntity(a);
      const entityB = this._convertResultToEntity(b);
      
      let valueA, valueB;
      
      if (typeof orderBy === 'function') {
        valueA = orderBy(entityA);
        valueB = orderBy(entityB);
      } else {
        valueA = entityA[orderBy];
        valueB = entityB[orderBy];
      }
      
      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedResults;
  }
  
  /**
   * Apply post-query grouping
   * @private
   */
  _applyPostGroupBy(results, groupBy) {
    const groups = new Map();
    
    for (const result of results) {
      const entity = this._convertResultToEntity(result);
      
      let groupKey;
      if (typeof groupBy === 'function') {
        groupKey = groupBy(entity);
      } else {
        groupKey = entity[groupBy];
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(entity);
    }
    
    // Convert to array of group objects
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      count: items.length
    }));
  }
  
  /**
   * Apply post-query aggregation
   * @private
   */
  _applyPostAggregate(results, aggregateFunction, field) {
    const entities = results.map(result => this._convertResultToEntity(result));
    
    switch (aggregateFunction) {
      case 'count':
        return entities.length;
      
      case 'sum':
        return entities.reduce((sum, entity) => sum + (entity[field] || 0), 0);
      
      case 'avg':
        const total = entities.reduce((sum, entity) => sum + (entity[field] || 0), 0);
        return entities.length > 0 ? total / entities.length : 0;
      
      case 'max':
        return Math.max(...entities.map(entity => entity[field] || 0));
      
      case 'min':
        return Math.min(...entities.map(entity => entity[field] || 0));
      
      default:
        if (typeof aggregateFunction === 'function') {
          return aggregateFunction(entities, field);
        }
        return entities.length;
    }
  }
  
  /**
   * Convert DataScript query result to entity object
   * @private
   */
  _convertResultToEntity(result) {
    if (Array.isArray(result) && result.length >= 3) {
      // DataScript tuple result: [entityId, attr, value]
      const [entityId, attr, value] = result;
      return {
        ':db/id': entityId,
        [attr]: value
      };
    } else if (Array.isArray(result) && result.length === 1) {
      // Entity ID only
      return { ':db/id': result[0] };
    } else {
      // Already an entity object or scalar value
      return result;
    }
  }
  
  /**
   * Create appropriate Handle type for result
   * @private
   */
  _createResultHandle(result, preferredType) {
    // Determine result type based on data and operations
    const hasSelectOperation = this.operations.some(op => op.type === 'select');
    const hasAggregateOperation = this.operations.some(op => op.type === 'aggregate');
    
    if (hasAggregateOperation) {
      // Aggregation results are scalar values
      return result;
    }
    
    if (hasSelectOperation) {
      // Selection might change the result type
      const selectOp = this.operations.find(op => op.type === 'select');
      // Analyze select function to determine result type
      // This is simplified - real implementation would be more sophisticated
      return result;
    }
    
    if (preferredType === 'entity') {
      // Handle different result formats from DataScript query
      let entityId = null;
      
      if (Array.isArray(result) && result.length > 0) {
        // Result is [entityId] or [entityId, attr, value]
        entityId = result[0];
      } else if (typeof result === 'object' && result[':db/id']) {
        // Result is an entity object
        entityId = result[':db/id'];
      } else if (typeof result === 'number') {
        // Result is directly an entity ID
        entityId = result;
      }
      
      if (entityId !== null) {
        return new EntityProxy(this.dataSource, entityId);
      }
    }
    
    // Return scalar value or original result
    return result;
  }
}

/**
 * Example DataSource implementation that uses DataStoreQueryBuilder
 */
class DataStoreDataSource {
  constructor(dataStore, schema) {
    this.dataStore = dataStore;
    this.schema = schema;
    this._subscriptions = new Map();
  }
  
  // Required DataSource methods
  
  query(querySpec) {
    // Execute DataScript query
    return this.dataStore.q(querySpec.find, querySpec.where);
  }
  
  subscribe(querySpec, callback) {
    // Set up DataScript subscription
    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscription.id);
      }
    };
    
    this._subscriptions.set(subscription.id, subscription);
    return subscription;
  }
  
  getSchema() {
    return this.schema;
  }
  
  // Query builder implementation
  queryBuilder(sourceHandle) {
    return new DataStoreQueryBuilder(this, sourceHandle);
  }
  
  // Optional methods
  
  update(updateSpec) {
    // Handle entity updates
    return this.dataStore.transact([updateSpec]);
  }
  
  validate(data) {
    // Validate against schema
    return true; // Simplified
  }
  
  getMetadata() {
    return {
      dataSourceType: 'DataScript',
      subscriptionCount: this._subscriptions.size,
      schemaVersion: this.schema.version || '1.0.0',
      capabilities: {
        query: true,
        subscribe: true,
        update: true,
        validate: true,
        queryBuilder: true
      }
    };
  }
}

export { DataStoreQueryBuilder, DataStoreDataSource };