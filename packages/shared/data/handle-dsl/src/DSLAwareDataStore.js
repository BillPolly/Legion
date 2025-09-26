/**
 * DSL-Aware DataStore - Extended DataStore with Handle DSL support
 * 
 * Extends the base DataStore to automatically detect and convert DSL query objects
 * to DataScript format. This allows the DataStore to work seamlessly with Handle DSL
 * without breaking existing functionality.
 */

import { DataStore } from '@legion/data-store';
import { DSLParser } from './parser.js';

export class DSLAwareDataStore extends DataStore {
  constructor(schema = {}, options = {}) {
    super(schema, options);
  }

  /**
   * Enhanced query method that supports both DataScript and DSL query formats
   * @param {Object|Array} querySpec - Query specification (DataScript format or DSL object)
   * @returns {Array} Query results
   */
  query(querySpec) {
    // Check if this is a DSL query object
    if (this._isDSLQuery(querySpec)) {
      // Convert DSL query to DataScript format
      const dataScriptQuery = DSLParser.handleQueryToDataScript(querySpec);
      // Execute converted query using parent method
      return super.query(dataScriptQuery);
    }
    
    // For non-DSL queries, use parent method directly
    return super.query(querySpec);
  }

  /**
   * Check if a query specification is a DSL query object
   * @private
   * @param {*} querySpec - Query specification to check
   * @returns {boolean} True if it's a DSL query object
   */
  _isDSLQuery(querySpec) {
    return (
      typeof querySpec === 'object' &&
      querySpec !== null &&
      querySpec.type === 'query' &&
      Array.isArray(querySpec.find) &&
      Array.isArray(querySpec.where)
    );
  }
}

/**
 * Factory function to create a DSL-aware DataStore instance
 * @param {Object} options - DataStore options including schema
 * @returns {DSLAwareDataStore} New DSL-aware DataStore instance
 */
export function createDSLAwareDataStore(options = {}) {
  const { schema, ...storeOptions } = options;
  return new DSLAwareDataStore(schema, storeOptions);
}