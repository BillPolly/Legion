/**
 * QueryBuilder - Fluent API for building MongoDB queries
 * 
 * Provides a chainable interface for constructing complex queries
 * with support for:
 * - Filtering with comparison and logical operators
 * - Projection (field selection/exclusion)
 * - Sorting
 * - Pagination (skip/limit)
 * - Aggregation pipelines
 * - Counting and distinct operations
 * 
 * All methods return a new QueryBuilder instance for immutability.
 * The execute() method returns a QueryResultHandle immediately.
 */

export class QueryBuilder {
  constructor(dataSource, dbName, collectionName, initialState = {}) {
    this.dataSource = dataSource;
    this.dbName = dbName;
    this.collectionName = collectionName;
    
    // Query state - immutable
    this._state = {
      filter: initialState.filter || {},
      projection: initialState.projection || null,
      sort: initialState.sort || null,
      skip: initialState.skip || 0,
      limit: initialState.limit || null,
      pipeline: initialState.pipeline || null,
      isAggregation: initialState.isAggregation || false,
      operation: initialState.operation || 'find'
    };
  }
  
  /**
   * Clone builder with new state
   * @private
   */
  _clone(updates = {}) {
    return new QueryBuilder(
      this.dataSource,
      this.dbName,
      this.collectionName,
      { ...this._state, ...updates }
    );
  }
  
  /**
   * Merge filters with existing filter
   * @private
   */
  _mergeFilter(newFilter) {
    // Handle special operators that shouldn't be merged directly
    if (newFilter.$or || newFilter.$and || newFilter.$nor || newFilter.$not) {
      return { ...this._state.filter, ...newFilter };
    }
    
    // Merge field-level filters
    const merged = { ...this._state.filter };
    for (const [key, value] of Object.entries(newFilter)) {
      if (merged[key] && typeof merged[key] === 'object' && typeof value === 'object') {
        // Merge operators for same field
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }
  
  /**
   * Add filter conditions (AND by default)
   * @param {Object} conditions - MongoDB filter conditions
   * @returns {QueryBuilder} New builder instance
   */
  where(conditions) {
    // If we already have a pipeline, we can't add more filter conditions
    // The filter should have been applied when building the pipeline
    if (this._state.pipeline) {
      throw new Error('Cannot add where conditions after aggregation pipeline has been started. Use pipeline() for complex aggregations.');
    }
    
    return this._clone({
      filter: this._mergeFilter(conditions)
    });
  }
  
  /**
   * Add OR conditions
   * @param {Array} conditions - Array of filter conditions
   * @returns {QueryBuilder} New builder instance
   */
  or(conditions) {
    const currentOr = this._state.filter.$or || [];
    return this._clone({
      filter: {
        ...this._state.filter,
        $or: [...currentOr, ...conditions]
      }
    });
  }
  
  /**
   * Add AND conditions explicitly
   * @param {Array} conditions - Array of filter conditions
   * @returns {QueryBuilder} New builder instance
   */
  and(conditions) {
    const currentAnd = this._state.filter.$and || [];
    return this._clone({
      filter: {
        ...this._state.filter,
        $and: [...currentAnd, ...conditions]
      }
    });
  }
  
  /**
   * Add NOT condition
   * @param {Object} condition - Filter condition to negate
   * @returns {QueryBuilder} New builder instance
   */
  not(condition) {
    // MongoDB uses field-level $not or top-level $nor
    // For simplicity, we'll convert to $nor
    return this.nor([condition]);
  }
  
  /**
   * Add NOR conditions
   * @param {Array} conditions - Array of filter conditions
   * @returns {QueryBuilder} New builder instance
   */
  nor(conditions) {
    const currentNor = this._state.filter.$nor || [];
    return this._clone({
      filter: {
        ...this._state.filter,
        $nor: [...currentNor, ...conditions]
      }
    });
  }
  
  /**
   * Select specific fields to include
   * @param {Array<string>} fields - Field names to include
   * @returns {QueryBuilder} New builder instance
   */
  select(fields) {
    const projection = {};
    for (const field of fields) {
      projection[field] = 1;
    }
    
    return this._clone({
      projection: { ...this._state.projection, ...projection }
    });
  }
  
  /**
   * Exclude specific fields
   * @param {Array<string>} fields - Field names to exclude
   * @returns {QueryBuilder} New builder instance
   */
  exclude(fields) {
    const projection = {};
    for (const field of fields) {
      projection[field] = 0;
    }
    
    return this._clone({
      projection: { ...this._state.projection, ...projection }
    });
  }
  
  /**
   * Sort results
   * @param {Object} sortSpec - MongoDB sort specification
   * @returns {QueryBuilder} New builder instance
   */
  sort(sortSpec) {
    // Don't validate here - let MongoDB handle it
    // This allows the error handling tests to work properly
    
    // If we already have a pipeline, append $sort to it
    if (this._state.pipeline) {
      const pipeline = [...this._state.pipeline];
      pipeline.push({ $sort: sortSpec });
      return this._clone({
        pipeline,
        isAggregation: true
      });
    }
    
    // Otherwise, just set the sort property
    return this._clone({
      sort: { ...this._state.sort, ...sortSpec }
    });
  }
  
  /**
   * Skip documents
   * @param {number} n - Number of documents to skip
   * @returns {QueryBuilder} New builder instance
   */
  skip(n) {
    if (typeof n !== 'number' || n < 0) {
      throw new Error('Skip value must be a non-negative number');
    }
    
    // If we already have a pipeline, append $skip to it
    if (this._state.pipeline) {
      const pipeline = [...this._state.pipeline];
      pipeline.push({ $skip: n });
      return this._clone({
        pipeline,
        isAggregation: true
      });
    }
    
    // Otherwise, just set the skip property
    return this._clone({ skip: n });
  }
  
  /**
   * Limit results
   * @param {number} n - Maximum number of documents
   * @returns {QueryBuilder} New builder instance
   */
  limit(n) {
    if (typeof n !== 'number' || n < 1) {
      throw new Error('Limit value must be a positive number');
    }
    
    // If we already have a pipeline, append $limit to it
    if (this._state.pipeline) {
      const pipeline = [...this._state.pipeline];
      pipeline.push({ $limit: n });
      return this._clone({
        pipeline,
        isAggregation: true
      });
    }
    
    // Otherwise, just set the limit property
    return this._clone({ limit: n });
  }
  
  /**
   * Use raw aggregation pipeline
   * @param {Array} pipeline - MongoDB aggregation pipeline
   * @returns {QueryBuilder} New builder instance
   */
  pipeline(pipeline) {
    if (!Array.isArray(pipeline)) {
      throw new Error('Pipeline must be an array');
    }
    
    return this._clone({
      pipeline,
      isAggregation: true
    });
  }
  
  /**
   * Add group stage to aggregation
   * @param {Object} groupSpec - MongoDB $group specification
   * @returns {QueryBuilder} New builder instance
   */
  group(groupSpec) {
    // Convert regular query to aggregation pipeline
    const pipeline = this._buildAggregationPipeline();
    pipeline.push({ $group: groupSpec });
    
    return this._clone({
      pipeline,
      isAggregation: true
    });
  }
  
  /**
   * Count documents
   * @returns {QueryResultHandle} Count result
   */
  count() {
    return this.dataSource.query({
      level: 'collection',
      database: this.dbName,
      collection: this.collectionName,
      operation: 'count',
      filter: this._state.filter
    });
  }
  
  /**
   * Get distinct values for a field
   * @param {string} field - Field name
   * @returns {QueryResultHandle} Distinct values
   */
  distinct(field) {
    return this.dataSource.query({
      level: 'collection',
      database: this.dbName,
      collection: this.collectionName,
      operation: 'distinct',
      field,
      filter: this._state.filter
    });
  }
  
  /**
   * Execute query with raw MongoDB options
   * @param {Object} rawQuery - Raw MongoDB query options
   * @returns {QueryBuilder} New builder instance
   */
  raw(rawQuery) {
    return this._clone({
      filter: rawQuery.filter || {},
      projection: rawQuery.projection || null,
      sort: rawQuery.sort || null,
      skip: rawQuery.skip || 0,
      limit: rawQuery.limit || null
    });
  }
  
  /**
   * Get raw MongoDB query object
   * @returns {Object} MongoDB query specification
   */
  toMongoQuery() {
    const query = {
      filter: this._state.filter
    };
    
    if (this._state.projection) {
      query.projection = this._state.projection;
    }
    
    if (this._state.sort) {
      query.sort = this._state.sort;
    }
    
    if (this._state.skip > 0) {
      query.skip = this._state.skip;
    }
    
    if (this._state.limit) {
      query.limit = this._state.limit;
    }
    
    return query;
  }
  
  /**
   * Build aggregation pipeline from current state
   * @private
   */
  _buildAggregationPipeline() {
    const pipeline = [];
    
    // Add match stage for filters
    if (Object.keys(this._state.filter).length > 0) {
      pipeline.push({ $match: this._state.filter });
    }
    
    // Add project stage for projection
    if (this._state.projection) {
      pipeline.push({ $project: this._state.projection });
    }
    
    // Add sort stage
    if (this._state.sort) {
      pipeline.push({ $sort: this._state.sort });
    }
    
    // Add skip stage
    if (this._state.skip > 0) {
      pipeline.push({ $skip: this._state.skip });
    }
    
    // Add limit stage
    if (this._state.limit) {
      pipeline.push({ $limit: this._state.limit });
    }
    
    return pipeline;
  }
  
  /**
   * Execute the query
   * @returns {QueryResultHandle} Query result handle
   */
  execute() {
    // If using aggregation pipeline
    if (this._state.isAggregation || this._state.pipeline) {
      return this.dataSource.query({
        level: 'collection',
        database: this.dbName,
        collection: this.collectionName,
        operation: 'aggregate',
        pipeline: this._state.pipeline || this._buildAggregationPipeline()
      });
    }
    
    // Regular find query
    const querySpec = {
      level: 'collection',
      database: this.dbName,
      collection: this.collectionName,
      operation: 'find',
      filter: this._state.filter
    };
    
    if (this._state.projection) {
      querySpec.projection = this._state.projection;
    }
    
    if (this._state.sort) {
      querySpec.sort = this._state.sort;
    }
    
    if (this._state.skip > 0) {
      querySpec.skip = this._state.skip;
    }
    
    if (this._state.limit) {
      querySpec.limit = this._state.limit;
    }
    
    return this.dataSource.query(querySpec);
  }
}