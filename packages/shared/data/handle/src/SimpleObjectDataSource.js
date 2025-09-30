/**
 * SimpleObjectDataSource - DataSource implementation for plain JavaScript objects
 * 
 * This is a simple DataSource implementation that works with plain JavaScript objects.
 * It provides basic query, subscription, and update capabilities for testing the DSL
 * and demonstrating the Handle/DataSource pattern.
 * 
 * The data is stored as a flat array of objects, with basic query matching capabilities.
 */

import { validateDataSourceInterface } from './DataSource.js';

export class SimpleObjectDataSource {
  constructor(initialData = []) {
    // Store data as array of objects
    this.data = Array.isArray(initialData) ? [...initialData] : [];
    
    // Track subscriptions for change notifications
    this._subscriptions = new Map();
    this._subscriptionId = 0;
    
    // Basic schema inference from data
    this._schema = this._inferSchema();
    
    // Validate that we implement the DataSource interface
    validateDataSourceInterface(this, 'SimpleObjectDataSource');
  }
  
  /**
   * REQUIRED: Execute query against the data
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Handle different query formats
    if (querySpec.type === 'query') {
      // Handle-generic query format from DSL
      return this._executeHandleQuery(querySpec);
    } else if (querySpec.find || querySpec.where) {
      // Direct datalog-style query
      return this._executeDatalogQuery(querySpec);
    } else {
      // Simple object matching
      return this._executeSimpleQuery(querySpec);
    }
  }
  
  /**
   * REQUIRED: Set up subscription for change notifications
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
    return subscription;
  }
  
  /**
   * REQUIRED: Get resource schema for introspection
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    return this._schema;
  }
  
  /**
   * OPTIONAL: Update resource data
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    const oldData = [...this.data];
    let changes = [];
    
    if (updateSpec.type === 'update') {
      // Handle-generic update format from DSL
      changes = this._executeHandleUpdate(updateSpec);
    } else {
      // Direct object updates
      changes = this._executeDirectUpdate(updateSpec);
    }
    
    // Notify subscribers of changes
    this._notifySubscribers(changes, oldData);
    
    // Re-infer schema after updates
    this._schema = this._inferSchema();
    
    return {
      success: true,
      changes,
      metadata: {
        itemsModified: changes.length,
        totalItems: this.data.length
      }
    };
  }
  
  /**
   * REQUIRED: Create query builder for Handle
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    return new SimpleObjectQueryBuilder(this, sourceHandle);
  }
  
  /**
   * Add data items to the data source
   */
  addData(items) {
    const itemsToAdd = Array.isArray(items) ? items : [items];
    this.data.push(...itemsToAdd);
    
    // Re-infer schema
    this._schema = this._inferSchema();
    
    // Notify subscribers
    this._notifySubscribers(itemsToAdd.map(item => ({ 
      type: 'add', 
      data: item 
    })), []);
    
    return this.data.length;
  }
  
  // Private implementation methods
  
  _executeHandleQuery(querySpec) {
    // Handle generic query format from DSL
    const { find, where } = querySpec;
    
    if (!find || !Array.isArray(find)) {
      throw new Error('Handle query must specify find variables');
    }
    
    // Simple implementation - filter data based on where clauses
    let filteredData = [...this.data];
    
    if (where && Array.isArray(where)) {
      filteredData = this.data.filter(item => {
        return where.every(clause => this._matchesClause(item, clause));
      });
    }
    
    // Project the requested fields
    return filteredData.map(item => {
      if (find.length === 1 && find[0] === '?item') {
        return item; // Return whole item
      }
      
      // Return requested fields
      const result = [];
      find.forEach(variable => {
        if (typeof variable === 'string' && variable.startsWith('?')) {
          const fieldName = variable.slice(1);
          result.push(item[fieldName]);
        }
      });
      
      return result.length === 1 ? result[0] : result;
    });
  }
  
  _executeDatalogQuery(querySpec) {
    // Handle datalog-style queries
    const { find, where } = querySpec;
    
    let results = [...this.data];
    
    if (where && Array.isArray(where)) {
      results = results.filter(item => {
        return where.every(clause => this._matchesClause(item, clause));
      });
    }
    
    if (find && Array.isArray(find)) {
      return results.map(item => {
        const result = [];
        find.forEach(variable => {
          if (typeof variable === 'string' && variable.startsWith('?')) {
            const varName = variable.slice(1);
            
            // Check if this variable represents the entire item
            if (this._isEntityVariable(variable, where)) {
              result.push(item);
            } else {
              // Otherwise, try to resolve it as a field name
              result.push(item[varName]);
            }
          } else {
            result.push(variable);
          }
        });
        return result.length === 1 ? result[0] : result;
      });
    }
    
    return results;
  }
  
  /**
   * Check if a variable represents an entity (appears as first element in where clauses)
   * @private
   */
  _isEntityVariable(variable, whereClauses) {
    // Phase 7: If where is not provided or empty and variable is '?item', treat as entity variable
    if (variable === '?item') {
      if (!whereClauses || !Array.isArray(whereClauses) || whereClauses.length === 0) {
        return true;
      }
    }

    if (!whereClauses || !Array.isArray(whereClauses)) {
      return false;
    }

    return whereClauses.some(clause => {
      return Array.isArray(clause) && clause.length >= 1 && clause[0] === variable;
    });
  }
  
  _executeSimpleQuery(querySpec) {
    // Handle simple object matching
    return this.data.filter(item => {
      return Object.entries(querySpec).every(([key, value]) => {
        if (typeof value === 'function') {
          return value(item[key]);
        }
        return item[key] === value;
      });
    });
  }
  
  _matchesClause(item, clause) {
    if (!Array.isArray(clause) || clause.length !== 3) {
      return false;
    }
    
    const [entity, attribute, value] = clause;
    
    // For simple objects, entity is ignored (we assume current item)
    // attribute is the field name (remove : prefix if present)
    const fieldName = typeof attribute === 'string' && attribute.startsWith(':') 
      ? attribute.slice(1) 
      : attribute;
    
    // Handle variable references
    if (typeof value === 'string' && value.startsWith('?')) {
      return true; // Variable - always matches for binding
    }
    
    // Direct value comparison
    return item[fieldName] === value;
  }
  
  _executeHandleUpdate(updateSpec) {
    // Handle generic update format from DSL
    const { assignments } = updateSpec;
    const changes = [];
    
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(assignment => {
        const { where, set } = assignment;
        
        // Find items matching where clause
        const matchingItems = this.data.filter(item => 
          where ? this._matchesClause(item, where) : true
        );
        
        // Update matching items
        matchingItems.forEach(item => {
          Object.entries(set || {}).forEach(([key, value]) => {
            const oldValue = item[key];
            item[key] = value;
            changes.push({
              type: 'update',
              item,
              field: key,
              oldValue,
              newValue: value
            });
          });
        });
      });
    }
    
    return changes;
  }
  
  _executeDirectUpdate(updateSpec) {
    // Handle direct object updates
    const changes = [];
    
    if (updateSpec.where && updateSpec.set) {
      // Update with where clause - handle MongoDB-style operators
      const matchingItems = this.data.filter(item => 
        this._matchesWhereClause(item, updateSpec.where)
      );
      
      matchingItems.forEach(item => {
        Object.entries(updateSpec.set).forEach(([key, value]) => {
          const oldValue = item[key];
          item[key] = value;
          changes.push({
            type: 'update',
            item,
            field: key,
            oldValue,
            newValue: value
          });
        });
      });
    } else if (updateSpec.add) {
      // Add new items
      const itemsToAdd = Array.isArray(updateSpec.add) ? updateSpec.add : [updateSpec.add];
      this.data.push(...itemsToAdd);
      
      itemsToAdd.forEach(item => {
        changes.push({
          type: 'add',
          item
        });
      });
    }
    
    return changes;
  }
  
  /**
   * Check if an item matches a where clause with MongoDB-style operators
   * @private
   */
  _matchesWhereClause(item, whereClause) {
    if (!whereClause || typeof whereClause !== 'object') {
      return true;
    }
    
    return Object.entries(whereClause).every(([key, value]) => {
      // Handle MongoDB-style operators
      if (key === '$or') {
        // $or operator - item matches if any condition matches
        if (!Array.isArray(value)) {
          return false;
        }
        return value.some(condition => this._matchesWhereClause(item, condition));
      } else if (key === '$and') {
        // $and operator - item matches if all conditions match
        if (!Array.isArray(value)) {
          return false;
        }
        return value.every(condition => this._matchesWhereClause(item, condition));
      } else if (key === '$not') {
        // $not operator - item matches if condition doesn't match
        return !this._matchesWhereClause(item, value);
      } else {
        // Simple field comparison
        return item[key] === value;
      }
    });
  }
  
  _notifySubscribers(changes, oldData) {
    for (const subscription of this._subscriptions.values()) {
      try {
        // Check if changes match subscription query
        if (this._changesMatchQuery(changes, subscription.querySpec, oldData)) {
          // Invoke callback synchronously
          subscription.callback(changes);
        }
      } catch (error) {
        console.warn('Error in subscription callback:', error);
      }
    }
  }
  
  _changesMatchQuery(changes, querySpec, oldData) {
    // Simple heuristic - if query would return different results, notify
    const oldResults = this._executeQueryOnData(querySpec, oldData);
    const newResults = this.query(querySpec);
    
    return JSON.stringify(oldResults) !== JSON.stringify(newResults);
  }
  
  _executeQueryOnData(querySpec, data) {
    const oldData = this.data;
    this.data = data;
    try {
      return this.query(querySpec);
    } finally {
      this.data = oldData;
    }
  }
  
  _inferSchema() {
    if (this.data.length === 0) {
      return {
        version: '1.0.0',
        attributes: {},
        relationships: {},
        constraints: {}
      };
    }
    
    const attributes = {};
    const fieldTypes = {};
    
    // Analyze first few items to infer schema
    const sampleSize = Math.min(this.data.length, 10);
    for (let i = 0; i < sampleSize; i++) {
      const item = this.data[i];
      Object.entries(item).forEach(([key, value]) => {
        if (!fieldTypes[key]) {
          fieldTypes[key] = new Set();
        }
        fieldTypes[key].add(typeof value);
      });
    }
    
    // Convert to schema format
    Object.entries(fieldTypes).forEach(([key, types]) => {
      const typeArray = Array.from(types);
      attributes[`:${key}`] = {
        valueType: typeArray.length === 1 ? typeArray[0] : 'string' // Default to string for mixed types
      };
    });
    
    return {
      version: '1.0.0',
      attributes,
      relationships: {},
      constraints: {}
    };
  }
}

/**
 * Simple Query Builder for SimpleObjectDataSource
 */
class SimpleObjectQueryBuilder {
  constructor(dataSource, sourceHandle) {
    this.dataSource = dataSource;
    this.sourceHandle = sourceHandle;
    this.operations = [];
  }
  
  // Query combinators
  where(predicate) {
    this.operations.push({ type: 'where', predicate });
    return this;
  }
  
  select(mapper) {
    this.operations.push({ type: 'select', mapper });
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
  
  // Terminal operations
  first() {
    const results = this._executeOperations();
    return results.length > 0 ? results[0] : null;
  }
  
  last() {
    const results = this._executeOperations();
    return results.length > 0 ? results[results.length - 1] : null;
  }
  
  count() {
    const results = this._executeOperations();
    return results.length;
  }
  
  toArray() {
    return this._executeOperations();
  }
  
  _executeOperations() {
    let data = [...this.dataSource.data];
    
    this.operations.forEach(operation => {
      switch (operation.type) {
        case 'where':
          data = data.filter(operation.predicate);
          break;
        case 'select':
          data = data.map(operation.mapper);
          break;
        case 'orderBy':
          data.sort((a, b) => {
            const aVal = typeof operation.field === 'function' 
              ? operation.field(a) 
              : a[operation.field];
            const bVal = typeof operation.field === 'function'
              ? operation.field(b)
              : b[operation.field];
            
            if (aVal < bVal) return operation.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return operation.direction === 'asc' ? 1 : -1;
            return 0;
          });
          break;
        case 'skip':
          data = data.slice(operation.count);
          break;
        case 'limit':
          data = data.slice(0, operation.count);
          break;
      }
    });
    
    return data;
  }
}