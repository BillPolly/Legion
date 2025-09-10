import { q } from '../../datascript/src/query/query.js';
import { pull } from '../../datascript/src/query/pull.js';

/**
 * QueryEngine - Advanced query system for KG-DataScript
 * Integrates DataScript's Datalog engine with object-oriented queries
 */
export class QueryEngine {
  constructor(dataScriptCore, liveStore, identityManager) {
    if (!dataScriptCore) {
      throw new Error('DataScript core is required');
    }
    if (!liveStore) {
      throw new Error('Live store is required');
    }
    if (!identityManager) {
      throw new Error('Identity manager is required');
    }
    
    this._core = dataScriptCore;
    this._store = liveStore;
    this._identityManager = identityManager;
    this._queryCache = new Map();
    this._preparedQueries = new Map();
    this._stats = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Execute a Datalog query
   * @param {Object} querySpec - DataScript query specification
   * @param {...any} inputs - Input parameters for the query
   * @returns {Array} Query results
   */
  query(querySpec, ...inputs) {
    const db = this._core.db();
    
    // Check cache
    const cacheKey = this._getCacheKey(querySpec, inputs);
    if (this._queryCache.has(cacheKey)) {
      this._stats.cacheHits++;
      return this._queryCache.get(cacheKey);
    }
    
    this._stats.cacheMisses++;
    this._stats.queries++;
    
    // Execute query
    let result;
    if (inputs.length > 0) {
      result = q(querySpec, db, ...inputs);
    } else {
      result = q(querySpec, db);
    }
    
    // Cache result
    this._queryCache.set(cacheKey, result);
    
    // Invalidate cache on next transaction
    this._setupCacheInvalidation();
    
    return result;
  }

  /**
   * Execute a query and return actual objects instead of IDs
   * @param {Object} querySpec - Query specification with object mapping
   * @returns {Array} Array of objects
   */
  queryWithObjects(querySpec) {
    // Execute base query to get object IDs
    const results = this.query(querySpec);
    
    const mappedResults = results.map(row => {
      if (Array.isArray(row)) {
        // Map each element that could be an object ID
        const mappedRow = row.map(item => {
          if (typeof item === 'number') {
            // Try to get object by this ID
            const obj = this._identityManager.getObject(item);
            return obj || item;
          }
          return item;
        });
        
        // If this row has only one element and it's an object, unwrap it
        if (mappedRow.length === 1 && typeof mappedRow[0] === 'object' && mappedRow[0] !== null) {
          return mappedRow[0];
        }
        
        return mappedRow;
      } else {
        // Single result
        if (typeof row === 'number') {
          const obj = this._identityManager.getObject(row);
          return obj || row;
        }
        return row;
      }
    }).filter(item => item !== null);
    
    return mappedResults;
  }

  /**
   * Hydrate query results by converting entity IDs to objects
   * @param {Array} results - Raw query results with entity IDs
   * @returns {Array} Results with actual objects instead of IDs
   */
  hydrateResults(results) {
    if (!results || results.length === 0) {
      return [];
    }

    return results.map(row => {
      if (Array.isArray(row)) {
        // Map each element that could be an entity ID
        const hydratedRow = row.map(item => {
          if (typeof item === 'number') {
            // Try to get object by this ID
            const obj = this._identityManager.getObject(item);
            return obj || item;
          }
          return item;
        });
        
        // If this row has only one element and it's an object, unwrap it
        if (hydratedRow.length === 1 && typeof hydratedRow[0] === 'object' && hydratedRow[0] !== null) {
          return hydratedRow[0];
        }
        
        return hydratedRow;
      } else {
        // Single result
        if (typeof row === 'number') {
          const obj = this._identityManager.getObject(row);
          return obj || row;
        }
        return row;
      }
    }).filter(item => item !== null);
  }

  /**
   * Execute a pull query
   * @param {Array} pattern - Pull pattern
   * @param {Array} entitySpec - Entity specification
   * @returns {Object} Pulled entity data
   */
  pull(pattern, entitySpec) {
    const db = this._core.db();
    
    // Find entity
    let entityId;
    if (Array.isArray(entitySpec)) {
      // Lookup ref like [:person/email "alice@test.com"]
      const [attr, value] = entitySpec;
      const results = q({
        find: ['?e'],
        where: [['?e', attr, value]]
      }, db);
      
      if (results.length > 0) {
        entityId = results[0][0];
      }
    } else {
      entityId = entitySpec;
    }
    
    if (!entityId) {
      return null;
    }
    
    // Execute pull
    return pull(db, pattern, entityId);
  }

  /**
   * Execute aggregation query
   * @param {Object} querySpec - Query with aggregation functions
   * @returns {Array} Aggregated results
   */
  aggregate(querySpec) {
    const db = this._core.db();
    const { find, where, groupBy = [] } = querySpec;
    
    // For simple count aggregations, handle directly
    if (find.length === 1 && find[0] === '(count ?e)' && groupBy.length === 0) {
      // Simple count query
      const countQuery = {
        find: ['?e'],
        where: where
      };
      const results = q(countQuery, db);
      return [[results.length]];
    }
    
    // Parse aggregation functions for more complex cases
    const aggregations = this._parseAggregations(find);
    
    // Execute base query to get raw data
    const baseQuery = {
      find: [...groupBy, ...aggregations.vars],
      where
    };
    
    const rawResults = q(baseQuery, db);
    
    // Group and aggregate
    return this._performAggregation(rawResults, aggregations, groupBy);
  }

  /**
   * Prepare a parameterized query for repeated execution
   * @param {Object} querySpec - Query specification
   * @returns {Object} Prepared query object
   */
  prepare(querySpec) {
    const preparedId = `prepared_${this._preparedQueries.size}`;
    
    const prepared = {
      id: preparedId,
      spec: querySpec,
      execute: (...inputs) => {
        return this.query(querySpec, ...inputs);
      }
    };
    
    this._preparedQueries.set(preparedId, prepared);
    return prepared;
  }

  /**
   * Execute query with statistics
   * @param {Object} querySpec - Query specification
   * @returns {Object} Results with statistics
   */
  queryWithStats(querySpec) {
    const startTime = Date.now();
    const db = this._core.db();
    
    // Count total entities before filtering
    const totalEntities = this._countEntities(querySpec.where);
    
    // Execute query
    const cacheKey = this._getCacheKey(querySpec);
    const cacheHit = this._queryCache.has(cacheKey);
    
    const data = this.query(querySpec);
    
    const executionTime = Date.now() - startTime;
    
    return {
      data,
      stats: {
        executionTime,
        rowsScanned: totalEntities,
        rowsReturned: data.length,
        cacheHit,
        queryPlan: this._generateQueryPlan(querySpec)
      }
    };
  }

  /**
   * Query historical state (time travel)
   * @param {number} tx - Transaction ID
   * @param {Object} querySpec - Query specification
   * @returns {Array} Historical query results
   */
  queryAsOf(tx, querySpec) {
    const historicalDb = this._core.asOf(tx);
    
    // Execute query on historical database
    if (querySpec.where) {
      return q(querySpec, historicalDb);
    }
    
    return [];
  }

  // Private helper methods

  _extractObjectVars(querySpec) {
    const vars = new Set();
    
    // Look for patterns that suggest object retrieval
    if (querySpec.find) {
      querySpec.find.forEach(item => {
        if (typeof item === 'string' && item.startsWith('?') && 
            !item.includes('(')) {
          // Check if this var is linked to :entity/id
          const hasEntityId = querySpec.where?.some(clause =>
            clause.includes(item) && 
            (clause.includes(':entity/id') || clause.includes('?Id'))
          );
          
          if (hasEntityId || item.endsWith('Id')) {
            vars.add(item);
          }
        }
      });
    }
    
    return Array.from(vars);
  }

  _addObjectIdClauses(querySpec, objectVars) {
    const modified = { ...querySpec };
    
    // Ensure we capture entity IDs for object variables
    objectVars.forEach(varName => {
      const idVarName = varName.endsWith('Id') ? varName : `${varName}Id`;
      
      // Add clause to capture entity ID if not present
      const hasIdClause = modified.where?.some(clause =>
        clause.includes(idVarName) && clause.includes(':entity/id')
      );
      
      if (!hasIdClause && modified.where) {
        // Infer entity variable from patterns
        const entityVar = varName.replace('Id', 'Entity');
        modified.where.push([entityVar, ':entity/id', idVarName]);
      }
    });
    
    return modified;
  }

  _mapResultsToObjects(results, objectVars, querySpec) {
    if (!results || results.length === 0) {
      return [];
    }
    
    // Determine which result columns contain object IDs
    const findVars = querySpec.find || [];
    const objectIndices = new Map();
    
    findVars.forEach((varName, index) => {
      if (typeof varName === 'string' && 
          (varName.endsWith('Id') || objectVars.includes(varName))) {
        // This column should be mapped to objects
        const objVarName = varName.replace('Id', '');
        objectIndices.set(index, objVarName);
      }
    });
    
    // Map results
    return results.map(row => {
      const mappedRow = [];
      
      row.forEach((value, index) => {
        if (objectIndices.has(index)) {
          // Convert ID to object
          const obj = this._identityManager.getObject(value);
          mappedRow.push(obj || value);
        } else {
          mappedRow.push(value);
        }
      });
      
      // If query returns single values, unwrap array
      return mappedRow.length === 1 ? mappedRow[0] : mappedRow;
    });
  }

  _parseAggregations(find) {
    const aggregations = {
      functions: [],
      vars: []
    };
    
    find.forEach(item => {
      if (typeof item === 'string') {
        const match = item.match(/\((sum|count|avg|min|max|distinct)\s+(\?[\w]+)\)/);
        if (match) {
          aggregations.functions.push({
            fn: match[1],
            var: match[2]
          });
          aggregations.vars.push(match[2]);
        }
      }
    });
    
    return aggregations;
  }

  _performAggregation(rawResults, aggregations, groupBy) {
    const groups = new Map();
    
    // Group results
    rawResults.forEach(row => {
      const groupKey = groupBy.map((_, i) => row[i]).join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(row);
    });
    
    // Aggregate each group
    const aggregated = [];
    
    groups.forEach((groupRows, groupKey) => {
      const groupValues = groupKey.split('|');
      const aggValues = [];
      
      aggregations.functions.forEach(({ fn, var: varName }) => {
        const varIndex = groupBy.length + aggregations.vars.indexOf(varName);
        const values = groupRows.map(row => row[varIndex]).filter(v => v != null);
        
        let result;
        switch (fn) {
          case 'count':
            result = values.length;
            break;
          case 'sum':
            result = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result = values.length > 0 ? 
              values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            result = Math.min(...values);
            break;
          case 'max':
            result = Math.max(...values);
            break;
          case 'distinct':
            result = new Set(values).size;
            break;
          default:
            result = null;
        }
        
        aggValues.push(result);
      });
      
      aggregated.push([...groupValues, ...aggValues]);
    });
    
    return aggregated;
  }

  _getCacheKey(querySpec, inputs = []) {
    return JSON.stringify({ querySpec, inputs });
  }

  _setupCacheInvalidation() {
    // Clear cache on next transaction
    if (!this._cacheInvalidationSetup) {
      this._cacheInvalidationSetup = true;
      
      // Listen for transactions
      const originalTransact = this._core.transact.bind(this._core);
      this._core.transact = (tx) => {
        const result = originalTransact(tx);
        this._queryCache.clear();
        return result;
      };
    }
  }

  _countEntities(whereClauses) {
    if (!whereClauses || whereClauses.length === 0) {
      return 0;
    }
    
    // Estimate based on entity types mentioned
    const entityTypes = new Set();
    whereClauses.forEach(clause => {
      if (clause.includes(':entity/type')) {
        entityTypes.add(clause[2]);
      }
    });
    
    // Count entities of those types
    let count = 0;
    entityTypes.forEach(type => {
      const results = q({
        find: ['(count ?e)'],
        where: [['?e', ':entity/type', type]]
      }, this._core.db());
      
      if (results.length > 0) {
        count += results[0][0];
      }
    });
    
    return count || 100; // Default estimate
  }

  _generateQueryPlan(querySpec) {
    return {
      type: 'datalog',
      indexes: this._identifyIndexes(querySpec),
      estimatedCost: this._estimateQueryCost(querySpec)
    };
  }

  _identifyIndexes(querySpec) {
    const indexes = [];
    
    if (querySpec.where) {
      querySpec.where.forEach(clause => {
        if (clause[1] && clause[1].startsWith(':')) {
          indexes.push({
            type: 'attribute',
            name: clause[1]
          });
        }
      });
    }
    
    return indexes;
  }

  _estimateQueryCost(querySpec) {
    // Simple cost estimation based on query complexity
    const clauseCount = querySpec.where?.length || 0;
    const hasAggregation = querySpec.find?.some(f => 
      typeof f === 'string' && f.includes('(')
    );
    const hasGroupBy = !!querySpec.groupBy;
    
    let cost = clauseCount * 10;
    if (hasAggregation) cost += 50;
    if (hasGroupBy) cost += 30;
    
    return cost;
  }
}