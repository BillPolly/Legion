/**
 * ContextResourceManager - Wraps ExecutionContext to implement DataSource interface
 * 
 * NOTE: Despite its name, this class implements the DataSource interface, not ResourceManager.
 * The name is kept for backward compatibility. Use ContextDataSource for new code.
 * 
 * This allows parent contexts to be treated as DataSources, enabling:
 * - Synchronous queries against context data
 * - Updates to context state
 * - Subscriptions to context changes
 * - Handle-based fluent query API
 * 
 * The context can contain various resources:
 * - Regular data values
 * - DataStore handles
 * - Database handles
 * - Git handles
 * - Any other Handle-based resources
 */

import { ContextHandle } from './ContextHandle.js';

export class ContextResourceManager {
  constructor(executionContext) {
    if (!executionContext) {
      throw new Error('ExecutionContext is required');
    }
    
    this.context = executionContext;
    this._subscriptions = new Map();
    this._handle = null;
    
    // Track context changes for subscriptions
    this._lastSnapshot = this._takeSnapshot();
  }
  
  /**
   * Execute query against the context - SYNCHRONOUS
   * Supports various query formats:
   * - Path queries: { path: "user.profile.name" }
   * - Pattern queries: { find: ['?value'], where: [['context', '?attr', '?value']] }
   * - Resource queries: { resource: 'database', query: {...} }
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Path-based query
    if (querySpec.path) {
      return this._queryPath(querySpec.path);
    }
    
    // Pattern-based query (DataScript style)
    if (querySpec.find || querySpec.where) {
      return this._queryPattern(querySpec);
    }
    
    // Resource-specific query
    if (querySpec.resource) {
      return this._queryResource(querySpec.resource, querySpec.query);
    }
    
    // Query all context data
    if (querySpec.all) {
      return this._getAllContextData();
    }
    
    throw new Error('Query specification must have path, find/where, resource, or all');
  }
  
  /**
   * Set up subscription for change notifications - SYNCHRONOUS
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
    // Start monitoring if first subscription
    if (this._subscriptions.size === 1) {
      this._startMonitoring();
    }
    
    return subscription;
  }
  
  /**
   * Get context schema for introspection - SYNCHRONOUS
   */
  getSchema() {
    const schema = {
      version: '1.0.0',
      attributes: {},
      resources: {},
      relationships: {}
    };
    
    // Analyze context structure
    const data = this._getAllContextData();
    
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object') {
        // Check if it's a Handle-based resource
        if (value.handleType) {
          schema.resources[key] = {
            type: value.handleType,
            schema: value.getSchema ? value.getSchema() : null
          };
        } else {
          // Regular attribute
          schema.attributes[key] = {
            type: typeof value,
            structure: Array.isArray(value) ? 'array' : 'object'
          };
        }
      } else {
        // Scalar attribute
        schema.attributes[key] = {
          type: typeof value
        };
      }
    }
    
    return schema;
  }
  
  /**
   * Update context data - SYNCHRONOUS
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    let changes = [];
    
    // Path-based update
    if (updateSpec.path && updateSpec.value !== undefined) {
      const oldValue = this._queryPath(updateSpec.path);
      this._updatePath(updateSpec.path, updateSpec.value);
      changes.push({
        type: 'update',
        path: updateSpec.path,
        oldValue,
        newValue: updateSpec.value
      });
    }
    
    // Batch updates
    if (updateSpec.updates && Array.isArray(updateSpec.updates)) {
      for (const update of updateSpec.updates) {
        const result = this.update(update);
        changes = changes.concat(result.changes || []);
      }
    }
    
    // Resource-specific update
    if (updateSpec.resource && updateSpec.update) {
      const resource = this._queryPath(updateSpec.resource);
      if (resource && typeof resource.update === 'function') {
        const result = resource.update(updateSpec.update);
        changes.push({
          type: 'resource-update',
          resource: updateSpec.resource,
          result
        });
      }
    }
    
    // Transaction-style update
    if (updateSpec.transaction) {
      changes = this._executeTransaction(updateSpec.transaction, updateSpec.data);
    }
    
    // Notify subscribers of changes
    this._notifySubscribers(changes);
    
    return {
      success: true,
      changes,
      metadata: {
        timestamp: Date.now(),
        contextId: this.context.id
      }
    };
  }
  
  /**
   * Create query builder for Handle - SYNCHRONOUS
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    // Return a context-aware query builder
    return new ContextQueryBuilder(this, sourceHandle);
  }
  
  /**
   * Get or create Handle for this context
   */
  getHandle() {
    if (!this._handle) {
      this._handle = new ContextHandle(this);
    }
    return this._handle;
  }
  
  // Private helper methods
  
  _queryPath(path) {
    const parts = path.split('.');
    let current = this._getAllContextData();
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  _updatePath(path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    
    let current = this._getAllContextData();
    
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[lastPart] = value;
  }
  
  _queryPattern(querySpec) {
    // Simplified pattern matching for context data
    const data = this._getAllContextData();
    const results = [];
    
    if (querySpec.where) {
      // Basic where clause support
      for (const [key, value] of Object.entries(data)) {
        let matches = true;
        
        for (const clause of querySpec.where) {
          if (Array.isArray(clause)) {
            const [subject, predicate, object] = clause;
            
            // Simple matching logic
            if (subject === 'context' && predicate === key) {
              if (object !== value && object !== '?value') {
                matches = false;
                break;
              }
            }
          }
        }
        
        if (matches) {
          results.push(querySpec.find ? value : [key, value]);
        }
      }
    }
    
    return results;
  }
  
  _queryResource(resourceName, resourceQuery) {
    const resource = this._queryPath(resourceName);
    
    if (!resource) {
      throw new Error(`Resource not found: ${resourceName}`);
    }
    
    // Check if it's a queryable resource (has query method)
    if (typeof resource.query === 'function') {
      return resource.query(resourceQuery);
    }
    
    // If it's a Handle, use its query method
    if (resource.handleType && typeof resource.query === 'function') {
      return resource.query(resourceQuery);
    }
    
    throw new Error(`Resource ${resourceName} is not queryable`);
  }
  
  _getAllContextData() {
    // Get all accessible data from the execution context
    const data = {};
    
    // Copy direct context properties
    if (this.context.data) {
      Object.assign(data, this.context.data);
    }
    
    // Include artifacts
    if (this.context.artifacts) {
      data.artifacts = this.context.artifacts;
    }
    
    // Include metadata
    if (this.context.metadata) {
      data.metadata = this.context.metadata;
    }
    
    // Include any Handle-based resources
    if (this.context.resources) {
      data.resources = this.context.resources;
    }
    
    return data;
  }
  
  _executeTransaction(transaction, data) {
    const changes = [];
    
    // Execute transaction operations
    for (const op of transaction) {
      const { type, ...params } = op;
      
      switch (type) {
        case 'set':
          const oldValue = this._queryPath(params.path);
          this._updatePath(params.path, params.value || data);
          changes.push({
            type: 'set',
            path: params.path,
            oldValue,
            newValue: params.value || data
          });
          break;
          
        case 'merge':
          const existing = this._queryPath(params.path) || {};
          const merged = { ...existing, ...(params.value || data) };
          this._updatePath(params.path, merged);
          changes.push({
            type: 'merge',
            path: params.path,
            merged
          });
          break;
          
        case 'push':
          const array = this._queryPath(params.path) || [];
          array.push(params.value || data);
          this._updatePath(params.path, array);
          changes.push({
            type: 'push',
            path: params.path,
            value: params.value || data
          });
          break;
          
        default:
          throw new Error(`Unknown transaction operation: ${type}`);
      }
    }
    
    return changes;
  }
  
  _takeSnapshot() {
    return JSON.stringify(this._getAllContextData());
  }
  
  _startMonitoring() {
    // Simple polling-based change detection
    // In a real implementation, could use Proxy or other mechanisms
    this._monitorInterval = setInterval(() => {
      const currentSnapshot = this._takeSnapshot();
      
      if (currentSnapshot !== this._lastSnapshot) {
        const changes = [{
          type: 'context-changed',
          timestamp: Date.now()
        }];
        
        this._notifySubscribers(changes);
        this._lastSnapshot = currentSnapshot;
      }
    }, 100); // Check every 100ms
  }
  
  _stopMonitoring() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }
  
  _notifySubscribers(changes) {
    for (const subscription of this._subscriptions.values()) {
      try {
        // Check if changes match subscription query
        if (this._matchesQuery(changes, subscription.querySpec)) {
          subscription.callback(changes);
        }
      } catch (error) {
        console.error('Subscription callback error:', error);
      }
    }
  }
  
  _matchesQuery(changes, querySpec) {
    // Simple matching - could be enhanced
    if (querySpec.all) {
      return true;
    }
    
    if (querySpec.path) {
      return changes.some(change => 
        change.path && change.path.startsWith(querySpec.path)
      );
    }
    
    return true; // Default to matching
  }
}

/**
 * Context-aware query builder
 */
class ContextQueryBuilder {
  constructor(dataSource, sourceHandle) {
    this.dataSource = dataSource;
    this.sourceHandle = sourceHandle;
    this.operations = [];
  }
  
  where(predicate) {
    this.operations.push({ type: 'where', predicate });
    return this;
  }
  
  select(mapper) {
    this.operations.push({ type: 'select', mapper });
    return this;
  }
  
  join(otherHandle, joinCondition) {
    this.operations.push({ type: 'join', otherHandle, joinCondition });
    return this;
  }
  
  orderBy(field, direction = 'asc') {
    this.operations.push({ type: 'orderBy', field, direction });
    return this;
  }
  
  limit(count) {
    this.operations.push({ type: 'limit', count });
    return this;
  }
  
  skip(count) {
    this.operations.push({ type: 'skip', count });
    return this;
  }
  
  groupBy(field) {
    this.operations.push({ type: 'groupBy', field });
    return this;
  }
  
  aggregate(func, field) {
    this.operations.push({ type: 'aggregate', func, field });
    return this;
  }
  
  // Terminal operations
  
  first() {
    const results = this._execute();
    return results.length > 0 ? results[0] : null;
  }
  
  last() {
    const results = this._execute();
    return results.length > 0 ? results[results.length - 1] : null;
  }
  
  count() {
    const results = this._execute();
    return results.length;
  }
  
  toArray() {
    return this._execute();
  }
  
  _execute() {
    // Execute operations against context data
    let data = this.dataSource._getAllContextData();
    let results = Array.isArray(data) ? data : Object.values(data);
    
    for (const op of this.operations) {
      switch (op.type) {
        case 'where':
          results = results.filter(op.predicate);
          break;
          
        case 'select':
          results = results.map(op.mapper);
          break;
          
        case 'orderBy':
          results = this._orderBy(results, op.field, op.direction);
          break;
          
        case 'limit':
          results = results.slice(0, op.count);
          break;
          
        case 'skip':
          results = results.slice(op.count);
          break;
          
        case 'groupBy':
          results = this._groupBy(results, op.field);
          break;
          
        case 'aggregate':
          return this._aggregate(results, op.func, op.field);
          
        case 'join':
          // Simplified join - would need more sophisticated implementation
          results = this._join(results, op.otherHandle, op.joinCondition);
          break;
      }
    }
    
    return results;
  }
  
  _orderBy(data, field, direction) {
    return [...data].sort((a, b) => {
      const aVal = typeof field === 'function' ? field(a) : a[field];
      const bVal = typeof field === 'function' ? field(b) : b[field];
      
      if (direction === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });
  }
  
  _groupBy(data, field) {
    const groups = {};
    
    for (const item of data) {
      const key = typeof field === 'function' ? field(item) : item[field];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    
    return Object.entries(groups).map(([key, items]) => ({
      key,
      items
    }));
  }
  
  _aggregate(data, func, field) {
    if (func === 'count') {
      return data.length;
    }
    
    const values = data.map(item => 
      field ? (typeof field === 'function' ? field(item) : item[field]) : item
    ).filter(v => v !== undefined && v !== null);
    
    switch (func) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
        
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
        
      case 'min':
        return Math.min(...values);
        
      case 'max':
        return Math.max(...values);
        
      default:
        if (typeof func === 'function') {
          return func(values);
        }
        throw new Error(`Unknown aggregate function: ${func}`);
    }
  }
  
  _join(leftData, otherHandle, joinCondition) {
    const rightData = otherHandle.toArray ? otherHandle.toArray() : [otherHandle.value()];
    const results = [];
    
    for (const left of leftData) {
      for (const right of rightData) {
        let matches = false;
        
        if (typeof joinCondition === 'function') {
          matches = joinCondition(left, right);
        } else if (typeof joinCondition === 'string') {
          matches = left[joinCondition] === right[joinCondition];
        }
        
        if (matches) {
          results.push({ left, right });
        }
      }
    }
    
    return results;
  }
}

// ContextResourceManager implements DataSource interface
// (validation removed - interface is validated by usage)
// NOTE: Despite its name, this is a DataSource not a ResourceManager