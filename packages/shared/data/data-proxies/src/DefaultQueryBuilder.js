/**
 * DefaultQueryBuilder - Default query builder for Handle-based resources backed by plain JavaScript objects
 * 
 * This is the default/fallback query builder that works within the Handle hierarchy.
 * Queries always flow up through parent Handles, and the underlying DataSource
 * might just have plain JavaScript objects/arrays as its data store.
 * 
 * Used when a DataSource doesn't provide a specialized query builder implementation.
 * The DataSource's query() method returns plain JavaScript objects/arrays which
 * this builder then processes with standard array operations.
 * 
 * Perfect for:
 * - DataSources backed by in-memory objects/arrays
 * - Mock/test DataSources with plain data
 * - API-based DataSources that return JSON
 * - Any DataSource without a specialized query backend (like DataScript)
 */

export class DefaultQueryBuilder {
  constructor(dataSource, sourceHandle) {
    this.dataSource = dataSource;
    this.sourceHandle = sourceHandle;
    this.operations = [];
  }
  
  // Query Combinator Methods - return new builder instances
  
  where(predicate) {
    return this._addOperation('where', predicate);
  }
  
  select(mapper) {
    return this._addOperation('select', mapper);
  }
  
  join(otherData, joinCondition) {
    return this._addOperation('join', otherData, joinCondition);
  }
  
  orderBy(field, direction = 'asc') {
    return this._addOperation('orderBy', field, direction);
  }
  
  limit(count) {
    return this._addOperation('limit', count);
  }
  
  skip(count) {
    return this._addOperation('skip', count);
  }
  
  groupBy(field) {
    return this._addOperation('groupBy', field);
  }
  
  aggregate(aggregateFunction, field) {
    // Terminal method - execute query and return aggregated result
    const results = this._executeQuery();
    return this._applyAggregate(results, aggregateFunction, field);
  }
  
  // Terminal methods - execute query and return results
  
  first() {
    const results = this._executeQuery();
    if (!results || results.length === 0) {
      return null;
    }
    // Return first result - might be entity ID, object, or Handle
    return this._wrapResult(results[0]);
  }
  
  last() {
    const results = this._executeQuery();
    if (!results || results.length === 0) {
      return null;
    }
    // Return last result - might be entity ID, object, or Handle
    return this._wrapResult(results[results.length - 1]);
  }
  
  count() {
    const results = this._executeQuery();
    return Array.isArray(results) ? results.length : 0;
  }
  
  toArray() {
    const results = this._executeQuery();
    // Return array of wrapped results
    return Array.isArray(results) ? results.map(r => this._wrapResult(r)) : [];
  }
  
  // Private implementation methods
  
  _addOperation(type, ...args) {
    const newBuilder = new DefaultQueryBuilder(this.dataSource, this.sourceHandle);
    newBuilder.operations = [...this.operations, { type, args }];
    return newBuilder;
  }
  
  _executeQuery() {
    // Get data from source Handle through DataSource
    let results = this._getSourceData();
    
    // Apply each operation in sequence
    for (const operation of this.operations) {
      results = this._applyOperation(results, operation);
    }
    
    return results;
  }
  
  _getSourceData() {
    // Query the source Handle to get the underlying data
    // The DataSource returns plain JavaScript objects/arrays
    if (this.sourceHandle.collectionSpec) {
      // CollectionProxy - query returns array of results
      const data = this.dataSource.query(this.sourceHandle.collectionSpec);
      return this._ensureArray(data);
    } else if (this.sourceHandle.querySpec) {
      // StreamProxy or other queryable Handle
      const data = this.dataSource.query(this.sourceHandle.querySpec);
      return this._ensureArray(data);
    } else if (this.sourceHandle.entityId !== undefined) {
      // EntityProxy - query for entity data
      const entityData = this.dataSource.query({
        find: ['*'],
        where: [['?e', ':db/id', this.sourceHandle.entityId]]
      });
      return this._ensureArray(entityData);
    } else if (typeof this.sourceHandle.value === 'function') {
      // Handle with value() method - get the value directly
      const value = this.sourceHandle.value();
      return this._ensureArray(value);
    } else {
      // Unknown Handle type - return empty array
      return [];
    }
  }
  
  _ensureArray(data) {
    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object') {
      return [data];
    }
    return [];
  }
  
  _applyOperation(data, operation) {
    const { type, args } = operation;
    
    switch (type) {
      case 'where':
        return this._applyWhere(data, args[0]);
      case 'select':
        return this._applySelect(data, args[0]);
      case 'join':
        return this._applyJoin(data, args[0], args[1]);
      case 'orderBy':
        return this._applyOrderBy(data, args[0], args[1]);
      case 'limit':
        return this._applyLimit(data, args[0]);
      case 'skip':
        return this._applySkip(data, args[0]);
      case 'groupBy':
        return this._applyGroupBy(data, args[0]);
      case 'aggregate':
        return this._applyAggregate(data, args[0], args[1]);
      default:
        return data;
    }
  }
  
  _applyWhere(data, predicate) {
    if (!Array.isArray(data) || typeof predicate !== 'function') {
      return data;
    }
    
    return data.filter(item => {
      try {
        return predicate(item);
      } catch (error) {
        // Predicate failed - exclude item
        return false;
      }
    });
  }
  
  _applySelect(data, mapper) {
    if (!Array.isArray(data) || typeof mapper !== 'function') {
      return data;
    }
    
    return data.map(item => {
      try {
        return mapper(item);
      } catch (error) {
        // Mapper failed - return original
        return item;
      }
    });
  }
  
  _applyJoin(data, otherData, joinCondition) {
    if (!Array.isArray(data)) {
      return data;
    }
    
    // If otherData is a Handle, get its data
    let otherArray;
    if (otherData && typeof otherData.toArray === 'function') {
      // It's a Handle/query builder - execute to get data
      otherArray = this._ensureArray(otherData.toArray());
    } else if (otherData && typeof otherData.value === 'function') {
      // It's a Handle with value() method
      otherArray = this._ensureArray(otherData.value());
    } else {
      // It's already data
      otherArray = this._ensureArray(otherData);
    }
    
    // Perform join
    const joined = [];
    
    for (const item of data) {
      for (const otherItem of otherArray) {
        let shouldJoin = false;
        
        if (typeof joinCondition === 'function') {
          // Function-based join condition
          try {
            shouldJoin = joinCondition(item, otherItem);
          } catch (error) {
            shouldJoin = false;
          }
        } else if (typeof joinCondition === 'string') {
          // Attribute-based join (simple equality)
          shouldJoin = item[joinCondition] === otherItem[joinCondition];
        }
        
        if (shouldJoin) {
          // Merge items for join result
          joined.push({ ...item, ...otherItem });
        }
      }
    }
    
    return joined;
  }
  
  _applyOrderBy(data, field, direction = 'asc') {
    if (!Array.isArray(data)) {
      return data;
    }
    
    const sorted = [...data];
    
    sorted.sort((a, b) => {
      let valueA, valueB;
      
      if (typeof field === 'function') {
        // Function-based ordering
        try {
          valueA = field(a);
          valueB = field(b);
        } catch (error) {
          return 0;
        }
      } else if (typeof field === 'string') {
        // Field-based ordering
        valueA = a[field];
        valueB = b[field];
      } else {
        return 0;
      }
      
      // Handle null/undefined
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';
      
      // Compare values
      if (valueA < valueB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return sorted;
  }
  
  _applyLimit(data, count) {
    if (!Array.isArray(data) || typeof count !== 'number' || count <= 0) {
      return data;
    }
    
    return data.slice(0, count);
  }
  
  _applySkip(data, count) {
    if (!Array.isArray(data) || typeof count !== 'number' || count < 0) {
      return data;
    }
    
    return data.slice(count);
  }
  
  _applyGroupBy(data, field) {
    if (!Array.isArray(data)) {
      return data;
    }
    
    const groups = new Map();
    
    for (const item of data) {
      let key;
      
      if (typeof field === 'function') {
        // Function-based grouping
        try {
          key = field(item);
        } catch (error) {
          key = 'undefined';
        }
      } else if (typeof field === 'string') {
        // Field-based grouping
        key = item[field];
      } else {
        key = 'undefined';
      }
      
      // Ensure key is a string for Map
      const groupKey = String(key);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    }
    
    // Convert to array of group objects
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      count: items.length
    }));
  }
  
  _applyAggregate(data, aggregateFunction, field) {
    if (!Array.isArray(data)) {
      return data;
    }
    
    // Built-in aggregate functions
    switch (aggregateFunction) {
      case 'count':
        return data.length;
        
      case 'sum':
        return data.reduce((sum, item) => {
          const value = field ? item[field] : item;
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
        
      case 'avg':
        if (data.length === 0) return 0;
        const total = data.reduce((sum, item) => {
          const value = field ? item[field] : item;
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
        return total / data.length;
        
      case 'min':
        if (data.length === 0) return null;
        return Math.min(...data.map(item => {
          const value = field ? item[field] : item;
          return typeof value === 'number' ? value : Infinity;
        }));
        
      case 'max':
        if (data.length === 0) return null;
        return Math.max(...data.map(item => {
          const value = field ? item[field] : item;
          return typeof value === 'number' ? value : -Infinity;
        }));
        
      default:
        // Custom aggregate function
        if (typeof aggregateFunction === 'function') {
          try {
            return aggregateFunction(data, field);
          } catch (error) {
            return null;
          }
        }
        return data.length;
    }
  }
  
  _wrapResult(result) {
    // DefaultQueryBuilder returns results based on DataSource's design
    // Different DataSources may have different result strategies:
    // - DataStore returns EntityProxy handles
    // - PlainObject/API DataSources return plain objects
    // - Other DataSources might return other Handle types
    
    // Let the DataSource decide how to wrap results
    if (typeof this.dataSource.wrapQueryResult === 'function') {
      return this.dataSource.wrapQueryResult(result);
    }
    
    // Default: return the result as-is
    // Plain objects for PlainObjectDataSource
    // API responses for APIDataSource
    return result;
  }
}