/**
 * Base Entity Class
 * 
 * Provides common functionality for all data entities in the ROMA agent system.
 * Handles validation, serialization, and basic CRUD operations.
 */

import { createValidator, jsonSchemaToZod } from '@legion/schema';

export class BaseEntity {
  constructor(data = {}) {
    this.id = data[':db/id'] || data.id || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this._data = { ...data };
    this._dirty = false;
    this._errors = [];
  }

  /**
   * Get the entity type (should be overridden by subclasses)
   */
  static getEntityType() {
    throw new Error('getEntityType() must be implemented by subclasses');
  }

  /**
   * Get the schema definition for this entity type
   */
  static getSchema() {
    throw new Error('getSchema() must be implemented by subclasses');
  }

  /**
   * Get required fields for this entity type
   */
  static getRequiredFields() {
    throw new Error('getRequiredFields() must be implemented by subclasses');
  }

  /**
   * Validate the entity data using schema validation
   */
  validate() {
    this._errors = [];
    
    // First check required fields
    const required = this.constructor.getRequiredFields();
    for (const field of required) {
      if (!this.hasField(field)) {
        this._errors.push(`Missing required field: ${field}`);
      }
    }

    // Then run schema validation if available
    try {
      const jsonSchema = this.constructor.getJSONSchema();
      if (jsonSchema) {
        const validator = createValidator(jsonSchema);
        const data = this.toValidationFormat();
        const result = validator.validate(data);
        
        if (!result.success) {
          this._errors.push(...result.errors.map(err => err.message));
        }
      }
    } catch (error) {
      // Schema validation is optional, don't fail if not available
      console.warn(`Schema validation failed for ${this.constructor.getEntityType()}: ${error.message}`);
    }

    return this._errors.length === 0;
  }

  /**
   * Get JSON Schema for validation (should be overridden by subclasses)
   */
  static getJSONSchema() {
    return null; // Override in subclasses to provide JSON schema
  }

  /**
   * Convert entity data to format suitable for schema validation
   */
  toValidationFormat() {
    const result = {};
    const entityType = this.constructor.getEntityType();
    
    // Convert namespaced keys to plain object for validation
    for (const [key, value] of Object.entries(this._data)) {
      if (key.startsWith(`:${entityType}/`)) {
        const plainKey = key.replace(`:${entityType}/`, '');
        result[plainKey] = value;
      }
    }
    
    return result;
  }

  /**
   * Check if entity has a specific field
   */
  hasField(fieldName) {
    const dataKey = fieldName.startsWith(':') ? fieldName : `:${this.constructor.getEntityType()}/${fieldName}`;
    return this._data[dataKey] !== undefined && this._data[dataKey] !== null;
  }

  /**
   * Get a field value
   */
  getField(fieldName) {
    const dataKey = fieldName.startsWith(':') ? fieldName : `:${this.constructor.getEntityType()}/${fieldName}`;
    return this._data[dataKey];
  }

  /**
   * Set a field value
   */
  setField(fieldName, value) {
    const dataKey = fieldName.startsWith(':') ? fieldName : `:${this.constructor.getEntityType()}/${fieldName}`;
    this._data[dataKey] = value;
    this.updatedAt = new Date();
    this._dirty = true;
    return this;
  }

  /**
   * Get all validation errors
   */
  getErrors() {
    return [...this._errors];
  }

  /**
   * Check if entity has been modified
   */
  isDirty() {
    return this._dirty;
  }

  /**
   * Mark entity as clean (saved)
   */
  markClean() {
    this._dirty = false;
    return this;
  }

  /**
   * Convert to DataScript format for storage
   */
  toDataScript() {
    const result = { ...this._data };
    
    // Add metadata
    if (this.id) {
      result[':db/id'] = this.id;
    }
    
    return result;
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    const result = {};
    const entityType = this.constructor.getEntityType();
    
    // Convert namespaced keys to plain object
    for (const [key, value] of Object.entries(this._data)) {
      if (key.startsWith(`:${entityType}/`)) {
        const plainKey = key.replace(`:${entityType}/`, '');
        result[plainKey] = value;
      } else if (key.startsWith(':db/')) {
        result[key.replace(':db/', '')] = value;
      }
    }
    
    result.entityType = entityType;
    result.createdAt = this.createdAt;
    result.updatedAt = this.updatedAt;
    
    return result;
  }

  /**
   * Create entity from plain object
   */
  static fromJSON(json) {
    const data = {};
    const entityType = json.entityType || this.getEntityType();
    
    // Convert plain keys to namespaced format
    for (const [key, value] of Object.entries(json)) {
      if (!['entityType', 'createdAt', 'updatedAt', 'id'].includes(key)) {
        data[`:${entityType}/${key}`] = value;
      }
    }
    
    if (json.id) {
      data[':db/id'] = json.id;
    }
    
    const entity = new this(data);
    entity.createdAt = json.createdAt ? new Date(json.createdAt) : entity.createdAt;
    entity.updatedAt = json.updatedAt ? new Date(json.updatedAt) : entity.updatedAt;
    
    return entity;
  }

  /**
   * Clone the entity
   */
  clone() {
    const clonedData = JSON.parse(JSON.stringify(this._data));
    delete clonedData[':db/id']; // Remove ID for clone
    return new this.constructor(clonedData);
  }

  /**
   * Convert to string representation
   */
  toString() {
    const entityType = this.constructor.getEntityType();
    const id = this.id || 'new';
    return `${entityType}#${id}`;
  }
}