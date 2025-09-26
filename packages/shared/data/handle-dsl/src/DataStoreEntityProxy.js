/**
 * DataStore-compatible EntityProxy for Handle DSL
 * 
 * This is a simplified EntityProxy specifically designed to work directly with DataStore
 * without requiring the full ResourceManager/Handle pattern. It's used by the handle-dsl
 * examples and tests to provide a convenient interface for entity operations.
 */

export class EntityProxy {
  constructor(entityId, dataStore) {
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    if (!dataStore) {
      throw new Error('DataStore is required');
    }
    
    if (typeof dataStore.query !== 'function') {
      throw new Error('DataStore must have query method');
    }
    
    if (typeof dataStore.updateEntity !== 'function') {
      throw new Error('DataStore must have updateEntity method');
    }
    
    this.entityId = entityId;
    this.dataStore = dataStore;
  }
  
  /**
   * Get attribute value by name
   * @param {string} attributeName - Attribute name (must start with ':')
   * @returns {*} Attribute value or undefined if not found
   */
  get(attributeName) {
    if (!attributeName || typeof attributeName !== 'string') {
      throw new Error('Attribute name is required');
    }
    
    if (!attributeName.startsWith(':')) {
      throw new Error('Attribute name must start with \':\'');
    }
    
    // Query for specific attribute
    const results = this.dataStore.query({
      find: ['?value'],
      where: [
        [this.entityId, attributeName, '?value']
      ]
    });
    
    return results.length > 0 ? results[0][0] : undefined;
  }
  
  /**
   * Update entity with data (compatible with DSL update objects)
   * @param {Object} updateData - Update data with attributes to update
   * @returns {Object} Update result
   */
  update(updateData) {
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data is required and must be an object');
    }
    
    // Handle DSL update result that may have updateData and relationships
    let actualUpdateData = updateData;
    
    if (updateData.updateData) {
      // This is a DSL update result with separate updateData and relationships
      actualUpdateData = updateData.updateData;
      
      // Handle multi-valued operations if present
      if (updateData.relationships && Array.isArray(updateData.relationships)) {
        updateData.relationships.forEach(relation => {
          const [op, , attr, value] = relation;
          if (op === '+') {
            this.addValue(attr, value);
          } else if (op === '-') {
            this.removeValue(attr, value);
          }
        });
      }
    }
    
    // Update the entity through DataStore only if there's actual data to update
    let result = {};
    if (actualUpdateData && Object.keys(actualUpdateData).length > 0) {
      result = this.dataStore.updateEntity(this.entityId, actualUpdateData);
    }
    
    return {
      success: true,
      entityId: this.entityId,
      ...result
    };
  }
  
  /**
   * Execute entity-scoped query
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {Array} Query results scoped to this entity
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification is required');
    }
    
    if (!querySpec.find) {
      throw new Error('Query must have find clause');
    }
    
    if (!querySpec.where) {
      throw new Error('Query must have where clause');
    }
    
    // Replace ?this with actual entity ID in where clauses
    const entityScopedQuery = {
      find: querySpec.find,
      where: querySpec.where.map(clause => {
        if (Array.isArray(clause)) {
          return clause.map(item => {
            if (item === '?this') {
              return this.entityId;
            }
            return item;
          });
        }
        return clause;
      })
    };
    
    return this.dataStore.query(entityScopedQuery);
  }
  
  /**
   * Add a value to a multi-valued attribute (card:many)
   * @param {string} attribute - Attribute name
   * @param {*} value - Value to add
   */
  addValue(attribute, value) {
    // For many-valued attributes, get current values and add new one
    const currentValues = this.get(attribute);
    
    if (currentValues === undefined) {
      // No current values, set as array with single value
      this.dataStore.updateEntity(this.entityId, {
        [attribute]: [value]
      });
    } else if (Array.isArray(currentValues)) {
      // Add to existing array if not already present
      if (!currentValues.includes(value)) {
        this.dataStore.updateEntity(this.entityId, {
          [attribute]: [...currentValues, value]
        });
      }
    } else {
      // Current value is single, convert to array
      this.dataStore.updateEntity(this.entityId, {
        [attribute]: [currentValues, value]
      });
    }
  }
  
  /**
   * Remove a value from a multi-valued attribute (card:many)
   * @param {string} attribute - Attribute name
   * @param {*} value - Value to remove
   */
  removeValue(attribute, value) {
    const currentValues = this.get(attribute);
    
    if (Array.isArray(currentValues)) {
      const newValues = currentValues.filter(v => v !== value);
      this.dataStore.updateEntity(this.entityId, {
        [attribute]: newValues
      });
    }
  }
  
  /**
   * Add a relationship value (alias for addValue, kept for compatibility)
   * @deprecated Use addValue instead
   * @param {string} attribute - Attribute name
   * @param {*} value - Value to add
   */
  addRelation(attribute, value) {
    return this.addValue(attribute, value);
  }
  
  /**
   * Remove a relationship value (alias for removeValue, kept for compatibility)
   * @deprecated Use removeValue instead
   * @param {string} attribute - Attribute name
   * @param {*} value - Value to remove
   */
  removeRelation(attribute, value) {
    return this.removeValue(attribute, value);
  }
  
  /**
   * Check if entity exists in store
   * @returns {boolean} True if entity exists
   */
  exists() {
    try {
      const results = this.dataStore.query({
        find: ['?attr'],
        where: [
          [this.entityId, '?attr', '?value']
        ]
      });
      return results.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get current entity data
   * @returns {Object} Complete entity data with all attributes
   */
  value() {
    const querySpec = {
      find: ['?attr', '?value'],
      where: [[this.entityId, '?attr', '?value']]
    };
    
    const results = this.dataStore.query(querySpec);
    
    if (results.length === 0) {
      throw new Error('Entity not found');
    }
    
    // Convert results to entity object
    const entity = { ':db/id': this.entityId };
    results.forEach(([attr, value]) => {
      entity[attr] = value;
    });
    
    return entity;
  }
}