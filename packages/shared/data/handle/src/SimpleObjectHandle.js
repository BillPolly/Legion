/**
 * SimpleObjectHandle - Handle implementation for SimpleObjectDataSource
 * 
 * A simple Handle implementation that demonstrates how Handles work with DataSources.
 * This Handle works with plain JavaScript objects through SimpleObjectDataSource.
 */

import { Handle } from './Handle.js';

export class SimpleObjectHandle extends Handle {
  constructor(dataSource, context = {}) {
    super(dataSource);
    
    // Store context for this handle (e.g., filters, specific item reference)
    this.context = context;
  }
  
  /**
   * REQUIRED: Get current value
   * CRITICAL: Must be synchronous - no await!
   */
  value() {
    this._validateNotDestroyed();
    
    if (this.context.itemId !== undefined) {
      // Return specific item
      const items = this.dataSource.data.filter(item => 
        item.id === this.context.itemId || item._id === this.context.itemId
      );
      return items.length > 0 ? items[0] : null;
    } else if (this.context.filter) {
      // Return filtered items
      return this.dataSource.query(this.context.filter);
    } else {
      // Return all data
      return this.dataSource.data;
    }
  }
  
  /**
   * REQUIRED: Execute query with this handle as context
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    this._validateNotDestroyed();
    this._validateQuerySpec(querySpec);
    
    // Translate DSL query to SimpleObject format
    const translatedQuery = this._translateDSLQuery(querySpec);
    
    // Add context constraints to query if needed
    let contextualQuery = translatedQuery;
    
    if (this.context.filter) {
      // Convert context filter to query clauses
      const contextClauses = this._convertFilterToClauses(this.context.filter);
      
      // Combine context filter with query
      if (translatedQuery.where) {
        contextualQuery = {
          ...translatedQuery,
          where: [...(Array.isArray(translatedQuery.where) ? translatedQuery.where : [translatedQuery.where]), 
                  ...contextClauses]
        };
      } else {
        contextualQuery = {
          ...translatedQuery,
          where: contextClauses
        };
      }
    }
    
    return this.dataSource.query(contextualQuery);
  }
  
  /**
   * Create a new Handle for a specific item
   */
  item(itemId) {
    this._validateNotDestroyed();
    
    return new SimpleObjectHandle(this.dataSource, {
      ...this.context,
      itemId
    });
  }
  
  /**
   * Create a new Handle with additional filters
   */
  filter(filterSpec) {
    this._validateNotDestroyed();
    
    const combinedFilter = this.context.filter 
      ? { ...this.context.filter, ...filterSpec }
      : filterSpec;
    
    return new SimpleObjectHandle(this.dataSource, {
      ...this.context,
      filter: combinedFilter
    });
  }
  
  /**
   * Update data through this handle
   */
  update(updateSpec) {
    this._validateNotDestroyed();
    
    // Translate DSL update to SimpleObject format
    const translatedUpdate = this._translateDSLUpdate(updateSpec);
    
    // Add context constraints to update if needed
    let contextualUpdate = translatedUpdate;
    
    if (this.context.itemId !== undefined) {
      // Update specific item
      const updateData = translatedUpdate.set || translatedUpdate;
      contextualUpdate = {
        where: { 
          $or: [
            { id: this.context.itemId },
            { _id: this.context.itemId }
          ]
        },
        set: updateData
      };
    } else if (this.context.filter) {
      // Update filtered items
      const updateData = translatedUpdate.set || translatedUpdate;
      contextualUpdate = {
        where: this.context.filter,
        set: updateData
      };
    }
    
    return this.dataSource.update(contextualUpdate);
  }
  
  /**
   * Get all items as an array (convenience method)
   */
  toArray() {
    const value = this.value();
    return Array.isArray(value) ? value : [value].filter(v => v !== null);
  }
  
  /**
   * Get the count of items
   */
  count() {
    const value = this.value();
    return Array.isArray(value) ? value.length : (value !== null ? 1 : 0);
  }
  
  /**
   * Check if handle represents a single item or collection
   */
  get isSingleItem() {
    return this.context.itemId !== undefined;
  }
  
  /**
   * Check if handle has any items
   */
  get isEmpty() {
    const value = this.value();
    return Array.isArray(value) ? value.length === 0 : value === null;
  }
  
  /**
   * Translate DSL query format to SimpleObject format
   * @private
   */
  _translateDSLQuery(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      return querySpec;
    }
    
    // Handle DSL query format from query`...` template literals
    if (querySpec.type === 'query') {
      return this._translateHandleQuery(querySpec);
    }
    
    // Pass through other query formats
    return querySpec;
  }
  
  /**
   * Translate Handle query format to SimpleObject format
   * @private
   */
  _translateHandleQuery(handleQuery) {
    const { find, where } = handleQuery;
    
    // Translate where clauses to remove : prefixes
    const translatedWhere = where ? where.map(clause => this._translateClause(clause)) : [];
    
    return {
      find,
      where: translatedWhere,
      originalDSL: handleQuery.originalDSL
    };
  }
  
  /**
   * Translate individual where clause
   * @private
   */
  _translateClause(clause) {
    if (!Array.isArray(clause) || clause.length !== 3) {
      return clause;
    }
    
    const [entity, attribute, value] = clause;
    
    // Remove : prefix from attribute names for SimpleObject format
    const cleanAttribute = typeof attribute === 'string' && attribute.startsWith(':') 
      ? attribute.slice(1) 
      : attribute;
    
    return [entity, cleanAttribute, value];
  }
  
  /**
   * Convert simple object filter to DataScript-style clauses
   * @private
   */
  _convertFilterToClauses(filter) {
    const clauses = [];
    
    Object.entries(filter).forEach(([key, value]) => {
      // Create a clause for each filter entry
      // Use ?item as the entity variable (consistent with DSL queries)
      clauses.push(['?item', key, value]);
    });
    
    return clauses;
  }
  
  /**
   * Translate DSL update format to SimpleObject format
   * @private
   */
  _translateDSLUpdate(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      return updateSpec;
    }
    
    // Handle DSL update format from update`...` template literals
    if (updateSpec.type === 'update') {
      return this._translateHandleUpdate(updateSpec);
    }
    
    // Pass through other update formats
    return updateSpec;
  }
  
  /**
   * Translate Handle update format to SimpleObject format
   * @private
   */
  _translateHandleUpdate(handleUpdate) {
    const { assignments, where } = handleUpdate;
    
    // Convert assignments to simple object format
    const updateData = {};
    if (assignments) {
      assignments.forEach(assignment => {
        const cleanAttribute = assignment.attribute.startsWith(':') 
          ? assignment.attribute.slice(1) 
          : assignment.attribute;
        updateData[cleanAttribute] = assignment.value;
      });
    }
    
    // Convert where conditions to simple object format
    let whereConditions = {};
    if (where && where.length > 0) {
      where.forEach(condition => {
        if (Array.isArray(condition) && condition.length === 3) {
          const [attribute, operator, value] = condition;
          const cleanAttribute = attribute.startsWith(':') ? attribute.slice(1) : attribute;
          
          // For simplicity, only handle equals operator for now
          if (operator === '=') {
            whereConditions[cleanAttribute] = value;
          }
        }
      });
    }
    
    return {
      set: updateData,
      where: whereConditions,
      originalDSL: handleUpdate.originalDSL
    };
  }
}