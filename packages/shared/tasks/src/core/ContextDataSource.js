
// Simple DataSource validation (replacing @legion/handle dependency)
function validateDataSourceInterface(dataSource) {
  const required = ['query', 'subscribe', 'update'];
  for (const method of required) {
    if (typeof dataSource[method] !== 'function') {
      throw new Error(`DataSource must implement ${method} method`);
    }
  }
  return true;
}

/**
 * ContextDataSource - Wraps ExecutionContext to implement DataSource interface
 * 
 * Allows ExecutionContext to be used with Handle/DSL system for declarative data flow.
 * Provides synchronous operations required by DataSource interface.
 */



export class ContextDataSource {
  constructor(executionContext) {
    if (!executionContext) {
      throw new Error('ExecutionContext is required');
    }
    
    this.executionContext = executionContext;
    this._subscriptions = new Map();
    this._schema = this._generateContextSchema();
    
    // Validate that we implement DataSource interface
    validateDataSourceInterface(this, 'ContextDataSource');
  }
  
  /**
   * REQUIRED: Execute query against context data
   * CRITICAL: Synchronous operation - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Handle different query types
    if (querySpec.path) {
      return this._queryPath(querySpec.path);
    }
    
    if (querySpec.find || querySpec.where) {
      return this._queryPattern(querySpec);
    }
    
    if (querySpec.resource) {
      return this._queryResource(querySpec.resource, querySpec.query);
    }
    
    // DSL query format
    if (querySpec.type === 'query' && querySpec.originalDSL) {
      return this._queryDSL(querySpec);
    }
    
    throw new Error(`Unsupported query format: ${JSON.stringify(querySpec)}`);
  }
  
  /**
   * REQUIRED: Subscribe to context changes
   * CRITICAL: Synchronous subscription setup
   */
  subscribe(querySpec, callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    // Track subscription
    this._subscriptions.set(subscriptionId, subscription);
    
    // Set up context change monitoring (if context supports it)
    if (this.executionContext.on && typeof this.executionContext.on === 'function') {
      const contextListener = (changeData) => {
        // Check if change matches query spec
        if (this._matchesQuery(changeData, querySpec)) {
          callback(changeData);
        }
      };
      
      this.executionContext.on('change', contextListener);
      
      // Enhance unsubscribe to clean up context listener
      const originalUnsubscribe = subscription.unsubscribe;
      subscription.unsubscribe = () => {
        if (this.executionContext.off && typeof this.executionContext.off === 'function') {
          this.executionContext.off('change', contextListener);
        }
        originalUnsubscribe();
      };
    }
    
    return subscription;
  }
  
  /**
   * REQUIRED: Get context schema
   * CRITICAL: Synchronous operation
   */
  getSchema() {
    return this._schema;
  }
  
  /**
   * OPTIONAL: Update context data
   * CRITICAL: Synchronous operation
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    try {
      // Handle different update formats
      if (updateSpec.path && updateSpec.value !== undefined) {
        return this._updatePath(updateSpec.path, updateSpec.value);
      }
      
      if (updateSpec.set) {
        return this._updateSet(updateSpec.set);
      }
      
      if (updateSpec.transaction) {
        return this._updateTransaction(updateSpec.transaction, updateSpec.data);
      }
      
      // DSL update format
      if (updateSpec.type === 'update' && updateSpec.assignments) {
        return this._updateDSL(updateSpec);
      }
      
      throw new Error(`Unsupported update format: ${JSON.stringify(updateSpec)}`);
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * OPTIONAL: Validate data against context constraints
   * CRITICAL: Synchronous operation
   */
  validate(data) {
    // Basic validation - ensure data is not null/undefined
    if (data === null || data === undefined) {
      return false;
    }
    
    // Additional context-specific validation could go here
    return true;
  }
  
  /**
   * OPTIONAL: Get context metadata
   * CRITICAL: Synchronous operation
   */
  getMetadata() {
    return {
      dataSourceType: 'ExecutionContext',
      contextId: this.executionContext.id || 'unknown',
      subscriptionCount: this._subscriptions.size,
      artifactCount: Object.keys(this.executionContext.artifacts || {}).length,
      capabilities: {
        query: true,
        subscribe: true,
        update: true,
        validate: true,
        queryBuilder: true
      }
    };
  }
  
  /**
   * REQUIRED: Create query builder for Handle projections
   * CRITICAL: Synchronous operation
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    // Import DefaultQueryBuilder for context operations
    return import('@legion/data-proxies').then(({ DefaultQueryBuilder }) => {
      return new DefaultQueryBuilder(this, sourceHandle);
    });
  }
  
  // Private helper methods
  
  /**
   * Query by path (dot notation)
   */
  _queryPath(path) {
    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }
    
    const parts = path.split('.');
    let current = this.executionContext;
    
    for (const part of parts) {
      if (current == null) {
        return null;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Query by pattern (DataScript-style)
   */
  _queryPattern(querySpec) {
    // Simple pattern matching for context data
    const results = [];
    
    if (querySpec.find && querySpec.where) {
      // Extract entity type from where clause
      const entityType = this._extractEntityType(querySpec.where);
      
      if (entityType === 'artifacts') {
        // Query artifacts
        const artifacts = this.executionContext.artifacts || {};
        for (const [key, artifact] of Object.entries(artifacts)) {
          if (this._matchesWhereClauses(artifact, querySpec.where)) {
            results.push(this._formatResult(querySpec.find, { key, ...artifact }));
          }
        }
      } else if (entityType === 'tasks') {
        // Query tasks
        const tasks = this.executionContext.tasks || [];
        for (const task of tasks) {
          if (this._matchesWhereClauses(task, querySpec.where)) {
            results.push(this._formatResult(querySpec.find, task));
          }
        }
      } else {
        // Query general context data
        const contextData = { ...this.executionContext };
        if (this._matchesWhereClauses(contextData, querySpec.where)) {
          results.push(this._formatResult(querySpec.find, contextData));
        }
      }
    }
    
    return results;
  }
  
  /**
   * Query resource from context
   */
  _queryResource(resource, query) {
    const resourceData = this.executionContext[resource];
    
    if (!resourceData) {
      return [];
    }
    
    if (Array.isArray(resourceData)) {
      return resourceData.filter(item => this._matchesQuery(item, { query }));
    }
    
    return [resourceData];
  }
  
  /**
   * Query using DSL format
   */
  _queryDSL(querySpec) {
    // Convert DSL query to pattern query
    const patternQuery = {
      find: querySpec.find,
      where: querySpec.where
    };
    
    return this._queryPattern(patternQuery);
  }
  
  /**
   * Update by path
   */
  _updatePath(path, value) {
    const parts = path.split('.');
    let current = this.executionContext;
    
    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set final value
    const finalKey = parts[parts.length - 1];
    const oldValue = current[finalKey];
    current[finalKey] = value;
    
    // Notify subscribers
    this._notifySubscribers({
      type: 'update',
      path,
      oldValue,
      newValue: value
    });
    
    return { success: true, path, oldValue, newValue: value };
  }
  
  /**
   * Update using set operation
   */
  _updateSet(setData) {
    const changes = [];
    
    for (const [path, value] of Object.entries(setData)) {
      const result = this._updatePath(path, value);
      changes.push(result);
    }
    
    return { success: true, changes };
  }
  
  /**
   * Update using transaction
   */
  _updateTransaction(transaction, data) {
    const changes = [];
    
    if (typeof transaction === 'function') {
      // Function transaction
      const result = transaction(this.executionContext, data);
      changes.push({ type: 'function', result });
    } else if (Array.isArray(transaction)) {
      // Array of operations
      for (const operation of transaction) {
        const result = this.update(operation);
        changes.push(result);
      }
    } else {
      // Object transaction
      for (const [key, value] of Object.entries(transaction)) {
        const result = this._updatePath(key, value);
        changes.push(result);
      }
    }
    
    return { success: true, transaction: 'completed', changes };
  }
  
  /**
   * Update using DSL format
   */
  _updateDSL(updateSpec) {
    const changes = [];
    
    for (const assignment of updateSpec.assignments) {
      if (assignment.type === 'assignment') {
        // Regular assignment - update execution context directly
        this.executionContext[assignment.attribute] = assignment.value;
        changes.push({
          type: 'assignment',
          attribute: assignment.attribute,
          oldValue: this.executionContext[assignment.attribute],
          newValue: assignment.value
        });
      } else if (assignment.type === 'relationship-add') {
        // Add to relationship
        const currentValue = this.executionContext[assignment.attribute] || [];
        if (!Array.isArray(currentValue)) {
          // Convert to array if not already
          this.executionContext[assignment.attribute] = [currentValue, assignment.value];
        } else {
          this.executionContext[assignment.attribute] = [...currentValue, assignment.value];
        }
        changes.push({ 
          type: 'relationship-add', 
          attribute: assignment.attribute,
          value: assignment.value,
          newArray: this.executionContext[assignment.attribute]
        });
      } else if (assignment.type === 'relationship-remove') {
        // Remove from relationship
        const currentValue = this.executionContext[assignment.attribute];
        if (Array.isArray(currentValue)) {
          this.executionContext[assignment.attribute] = currentValue.filter(item => item !== assignment.value);
          changes.push({ 
            type: 'relationship-remove', 
            attribute: assignment.attribute,
            value: assignment.value,
            newArray: this.executionContext[assignment.attribute]
          });
        }
      }
    }
    
    // Notify subscribers of changes
    if (changes.length > 0) {
      this._notifySubscribers({ type: 'dsl-update', changes });
    }
    
    return { success: true, changes };
  }
  
  /**
   * Extract entity type from where clauses
   */
  _extractEntityType(whereClauses) {
    for (const clause of whereClauses) {
      if (Array.isArray(clause) && clause.length >= 3) {
        const [entity, attribute, value] = clause;
        if (attribute === ':entity/type' || attribute === 'entity/type') {
          return value;
        }
      }
    }
    return 'context'; // Default to context queries
  }
  
  /**
   * Check if data matches where clauses
   */
  _matchesWhereClauses(data, whereClauses) {
    for (const clause of whereClauses) {
      if (!this._matchesWhereClause(data, clause)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Check if data matches single where clause
   */
  _matchesWhereClause(data, clause) {
    if (!Array.isArray(clause) || clause.length < 3) {
      return true; // Skip invalid clauses
    }
    
    const [entity, attribute, expectedValue] = clause;
    
    // Extract attribute name (remove namespace prefix)
    const attrName = attribute.replace(/^:/, '').replace(/.*\//, '');
    const actualValue = data[attrName];
    
    // Handle variable placeholders
    if (typeof expectedValue === 'string' && expectedValue.startsWith('?')) {
      return true; // Variables always match
    }
    
    return actualValue === expectedValue;
  }
  
  /**
   * Format query results
   */
  _formatResult(findClause, data) {
    if (findClause.length === 1) {
      const variable = findClause[0];
      if (variable.startsWith('?')) {
        const attrName = variable.substring(1);
        return data[attrName];
      }
    }
    
    // Multiple variables - return array
    return findClause.map(variable => {
      if (variable.startsWith('?')) {
        const attrName = variable.substring(1);
        return data[attrName];
      }
      return variable;
    });
  }
  
  /**
   * Check if change matches query
   */
  _matchesQuery(changeData, querySpec) {
    // Simple matching - could be enhanced
    return true;
  }
  
  /**
   * Notify all subscribers of changes
   */
  _notifySubscribers(changeData) {
    for (const subscription of this._subscriptions.values()) {
      try {
        if (this._matchesQuery(changeData, subscription.querySpec)) {
          subscription.callback(changeData);
        }
      } catch (error) {
        console.warn('Subscription callback error:', error);
      }
    }
  }
  
  /**
   * Generate schema from context structure
   */
  _generateContextSchema() {
    return {
      version: '1.0.0',
      type: 'ExecutionContext',
      attributes: {
        id: { type: 'string', description: 'Context identifier' },
        taskId: { type: 'string', description: 'Parent task ID' },
        status: { type: 'string', description: 'Execution status' },
        artifacts: { type: 'object', description: 'Generated artifacts' },
        tasks: { type: 'array', description: 'Child tasks' },
        metadata: { type: 'object', description: 'Additional metadata' }
      },
      relationships: {
        parentTask: { type: 'reference', target: 'Task' },
        childTasks: { type: 'collection', target: 'Task' },
        artifacts: { type: 'collection', target: 'Artifact' }
      },
      constraints: {
        required: ['id', 'status'],
        unique: ['id']
      }
    };
  }
}