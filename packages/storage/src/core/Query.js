/**
 * Query - Abstract query builder for storage operations
 * 
 * Provides a provider-agnostic way to build queries that can be
 * translated to provider-specific query languages (MongoDB, SQL, etc.)
 */

export class Query {
  constructor(collection = null) {
    this.collection = collection;
    this.criteria = {};
    this.options = {};
    this.pipeline = [];
  }

  /**
   * Set the collection for this query
   * @param {string} collection - Collection name
   * @returns {Query}
   */
  from(collection) {
    this.collection = collection;
    return this;
  }

  /**
   * Add equality criteria
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Query}
   */
  where(field, value) {
    this.criteria[field] = value;
    return this;
  }

  /**
   * Add range criteria (greater than)
   * @param {string} field - Field name
   * @param {*} value - Minimum value
   * @returns {Query}
   */
  gt(field, value) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$gt = value;
    return this;
  }

  /**
   * Add range criteria (greater than or equal)
   * @param {string} field - Field name
   * @param {*} value - Minimum value
   * @returns {Query}
   */
  gte(field, value) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$gte = value;
    return this;
  }

  /**
   * Add range criteria (less than)
   * @param {string} field - Field name
   * @param {*} value - Maximum value
   * @returns {Query}
   */
  lt(field, value) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$lt = value;
    return this;
  }

  /**
   * Add range criteria (less than or equal)
   * @param {string} field - Field name
   * @param {*} value - Maximum value
   * @returns {Query}
   */
  lte(field, value) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$lte = value;
    return this;
  }

  /**
   * Add in criteria (value in array)
   * @param {string} field - Field name
   * @param {Array} values - Array of possible values
   * @returns {Query}
   */
  in(field, values) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$in = values;
    return this;
  }

  /**
   * Add regex criteria
   * @param {string} field - Field name
   * @param {string|RegExp} pattern - Regex pattern
   * @param {string} flags - Regex flags
   * @returns {Query}
   */
  regex(field, pattern, flags = 'i') {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$regex = pattern;
    if (flags) this.criteria[field].$options = flags;
    return this;
  }

  /**
   * Add exists criteria
   * @param {string} field - Field name
   * @param {boolean} exists - Whether field should exist
   * @returns {Query}
   */
  exists(field, exists = true) {
    if (!this.criteria[field]) this.criteria[field] = {};
    this.criteria[field].$exists = exists;
    return this;
  }

  /**
   * Set sort order
   * @param {string|Object} field - Field name or sort object
   * @param {number} direction - Sort direction (1 for asc, -1 for desc)
   * @returns {Query}
   */
  sort(field, direction = 1) {
    if (typeof field === 'object') {
      this.options.sort = field;
    } else {
      if (!this.options.sort) this.options.sort = {};
      this.options.sort[field] = direction;
    }
    return this;
  }

  /**
   * Set limit
   * @param {number} count - Maximum number of documents
   * @returns {Query}
   */
  limit(count) {
    this.options.limit = count;
    return this;
  }

  /**
   * Set skip
   * @param {number} count - Number of documents to skip
   * @returns {Query}
   */
  skip(count) {
    this.options.skip = count;
    return this;
  }

  /**
   * Set projection (fields to include/exclude)
   * @param {Object|string} fields - Projection specification
   * @returns {Query}
   */
  select(fields) {
    if (typeof fields === 'string') {
      // Convert space-separated string to projection object
      const fieldArray = fields.split(' ');
      this.options.projection = {};
      fieldArray.forEach(field => {
        if (field.startsWith('-')) {
          this.options.projection[field.substring(1)] = 0;
        } else {
          this.options.projection[field] = 1;
        }
      });
    } else {
      this.options.projection = fields;
    }
    return this;
  }

  /**
   * Add aggregation stage
   * @param {Object} stage - Aggregation stage
   * @returns {Query}
   */
  aggregate(stage) {
    this.pipeline.push(stage);
    return this;
  }

  /**
   * Add match stage to aggregation pipeline
   * @param {Object} criteria - Match criteria
   * @returns {Query}
   */
  match(criteria) {
    this.pipeline.push({ $match: criteria });
    return this;
  }

  /**
   * Add group stage to aggregation pipeline
   * @param {Object} groupSpec - Group specification
   * @returns {Query}
   */
  group(groupSpec) {
    this.pipeline.push({ $group: groupSpec });
    return this;
  }

  /**
   * Build the final query object
   * @returns {Object}
   */
  build() {
    return {
      collection: this.collection,
      criteria: this.criteria,
      options: this.options,
      pipeline: this.pipeline
    };
  }

  /**
   * Clone this query
   * @returns {Query}
   */
  clone() {
    const cloned = new Query(this.collection);
    cloned.criteria = JSON.parse(JSON.stringify(this.criteria));
    cloned.options = JSON.parse(JSON.stringify(this.options));
    cloned.pipeline = JSON.parse(JSON.stringify(this.pipeline));
    return cloned;
  }
}