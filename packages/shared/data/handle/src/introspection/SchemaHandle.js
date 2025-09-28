/**
 * SchemaHandle - Handle wrapper for schema introspection
 * 
 * Makes schemas themselves queryable and updatable as Handles.
 * Wraps SchemaDataSource to provide Handle interface for schema operations.
 * 
 * This enables:
 * - Query schema structure (entity types, properties, relationships, constraints)
 * - Update schema dynamically (add/remove properties, modify constraints)
 * - Validate data against schemas
 * - Subscribe to schema changes
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { Handle } from '../Handle.js';
import { SchemaDataSource } from './SchemaDataSource.js';

export class SchemaHandle extends Handle {
  /**
   * Create a SchemaHandle wrapping a schema object
   * 
   * @param {Object} schema - The schema object to wrap (JSON Schema, TypeScript interface, etc.)
   * @param {Object} options - Configuration options
   * @param {string} options.format - Schema format: 'json-schema', 'typescript', 'custom'
   * @param {Handle} options.parent - Parent Handle (optional)
   */
  constructor(schema, options = {}) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object');
    }
    
    // Create SchemaDataSource for this schema
    const dataSource = new SchemaDataSource(schema, {
      format: options.format
    });
    
    // Initialize Handle with SchemaDataSource
    super(dataSource);
    
    // Store reference to wrapped schema (through dataSource)
    this._schemaDataSource = dataSource;
  }
  
  /**
   * Get the value of this SchemaHandle (the schema object)
   * Required by Handle base class
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} The wrapped schema object
   */
  value() {
    return this.getSchema();
  }
  
  /**
   * Get metadata about this SchemaHandle
   * Provides information about the handle type and schema format
   * 
   * @returns {Object} Metadata object with handleType and schemaFormat
   */
  get metadata() {
    return {
      handleType: 'schema',
      schemaFormat: this._schemaDataSource._format
    };
  }
  
  /**
   * Get the wrapped schema object
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} The wrapped schema object
   */
  getSchema() {
    return this._schemaDataSource._schema;
  }
  
  /**
   * Get schema format (json-schema, typescript, custom)
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {string} Schema format
   */
  getFormat() {
    return this._schemaDataSource._format;
  }
  
  /**
   * Query schema structure
   * CRITICAL: Must be synchronous - no await!
   * 
   * Supported query types:
   * - 'entity-types': Get all entity types defined in schema
   * - 'properties': Get properties for an entity type
   * - 'relationships': Get relationships for an entity type
   * - 'constraints': Get constraints for an entity type
   * - 'required-properties': Get required properties for an entity type
   * - 'schema-type': Get the schema type (object, array, string, etc.)
   * - 'schema-metadata': Get schema metadata (title, description, version, etc.)
   * - 'validation-rules': Get validation rules for an entity type
   * - 'nested-schemas': Get nested schemas for an entity type
   * 
   * @param {Object} querySpec - Query specification
   * @returns {*} Query results
   */
  query(querySpec) {
    // Delegate directly to SchemaDataSource
    return this._schemaDataSource.query(querySpec);
  }
  
  /**
   * Update schema structure
   * CRITICAL: Must be synchronous - no await!
   * 
   * Supported update types:
   * - 'add-entity-type': Add new entity type to schema
   * - 'remove-entity-type': Remove entity type from schema
   * - 'add-property': Add property to entity type
   * - 'modify-property': Modify existing property
   * - 'remove-property': Remove property from entity type
   * - 'add-relationship': Add relationship between entity types
   * - 'remove-relationship': Remove relationship
   * - 'add-constraint': Add constraint to entity type
   * - 'remove-constraint': Remove constraint
   * 
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    // Delegate to dataSource through parent Handle (if implemented)
    if (!this.dataSource.update) {
      throw new Error('Schema updates not supported by this Handle');
    }
    
    return this.dataSource.update(updateSpec);
  }
  
  /**
   * Validate data against this schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {*} data - Data to validate
   * @returns {Object} Validation result with { isValid, errors, schema }
   */
  validate(data) {
    // Delegate to SchemaDataSource
    return this._schemaDataSource.validate(data);
  }
  
  /**
   * Subscribe to schema changes
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    // Delegate directly to SchemaDataSource
    return this._schemaDataSource.subscribe(querySpec, callback);
  }
  
  /**
   * Get all entity types from schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Array<string>} Array of entity type names
   */
  getEntityTypes() {
    return this.query({ type: 'entity-types' });
  }
  
  /**
   * Get properties for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Array<Object>} Array of property objects
   */
  getProperties(entityType) {
    return this.query({ type: 'properties', entityType });
  }
  
  /**
   * Get relationships for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Array<Object>} Array of relationship objects
   */
  getRelationships(entityType) {
    return this.query({ type: 'relationships', entityType });
  }
  
  /**
   * Get constraints for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Object} Constraints object
   */
  getConstraints(entityType) {
    return this.query({ type: 'constraints', entityType });
  }
  
  /**
   * Get required properties for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Array<string>} Array of required property names
   */
  getRequiredProperties(entityType) {
    return this.query({ type: 'required-properties', entityType });
  }
  
  /**
   * Get schema type (object, array, string, etc.)
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {string} Schema type
   */
  getSchemaType() {
    return this.query({ type: 'schema-type' });
  }
  
  /**
   * Get schema metadata (title, description, version, etc.)
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} Schema metadata
   */
  getMetadata() {
    return this.query({ type: 'schema-metadata' });
  }
  
  /**
   * Get validation rules for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Array<Object>} Array of validation rule objects
   */
  getValidationRules(entityType) {
    return this.query({ type: 'validation-rules', entityType });
  }
  
  /**
   * Get nested schemas for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @returns {Array<Object>} Array of nested schema objects
   */
  getNestedSchemas(entityType) {
    return this.query({ type: 'nested-schemas', entityType });
  }
  
  /**
   * Add entity type to schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Entity type name
   * @param {Object} attributes - Type attributes (optional)
   * @returns {boolean} True if successful
   */
  addEntityType(typeName, attributes = {}) {
    return this.update({
      type: 'add-entity-type',
      typeName,
      attributes
    });
  }
  
  /**
   * Remove entity type from schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Entity type name
   * @returns {boolean} True if successful
   */
  removeEntityType(typeName) {
    return this.update({
      type: 'remove-entity-type',
      typeName
    });
  }
  
  /**
   * Add property to entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} propertyName - Property name
   * @param {Object} propertySchema - Property schema
   * @returns {boolean} True if successful
   */
  addProperty(entityType, propertyName, propertySchema) {
    return this.update({
      type: 'add-property',
      entityType,
      propertyName,
      propertySchema
    });
  }
  
  /**
   * Modify property in entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} propertyName - Property name
   * @param {Object} propertySchema - Updated property schema
   * @returns {boolean} True if successful
   */
  modifyProperty(entityType, propertyName, propertySchema) {
    return this.update({
      type: 'modify-property',
      entityType,
      propertyName,
      propertySchema
    });
  }
  
  /**
   * Remove property from entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} propertyName - Property name
   * @returns {boolean} True if successful
   */
  removeProperty(entityType, propertyName) {
    return this.update({
      type: 'remove-property',
      entityType,
      propertyName
    });
  }
  
  /**
   * Add relationship between entity types
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} source - Source entity type
   * @param {string} target - Target entity type
   * @param {string} relationship - Relationship name
   * @param {string} relationshipType - Relationship type ('belongsTo', 'hasMany', etc.)
   * @returns {boolean} True if successful
   */
  addRelationship(source, target, relationship, relationshipType = 'belongsTo') {
    return this.update({
      type: 'add-relationship',
      source,
      target,
      relationship,
      relationshipType
    });
  }
  
  /**
   * Remove relationship between entity types
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} source - Source entity type
   * @param {string} target - Target entity type
   * @param {string} relationship - Relationship name
   * @returns {boolean} True if successful
   */
  removeRelationship(source, target, relationship) {
    return this.update({
      type: 'remove-relationship',
      source,
      target,
      relationship
    });
  }
  
  /**
   * Add constraint to entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} constraintName - Constraint name
   * @param {*} constraintValue - Constraint value
   * @returns {boolean} True if successful
   */
  addConstraint(entityType, constraintName, constraintValue) {
    return this.update({
      type: 'add-constraint',
      entityType,
      constraintName,
      constraintValue
    });
  }
  
  /**
   * Remove constraint from entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} constraintName - Constraint name
   * @returns {boolean} True if successful
   */
  removeConstraint(entityType, constraintName) {
    return this.update({
      type: 'remove-constraint',
      entityType,
      constraintName
    });
  }
  
  /**
   * Convert schema to JSON Schema format
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} JSON Schema object
   */
  toJSONSchema() {
    // If already JSON Schema format, return as-is
    if (this._schemaDataSource._format === 'json-schema') {
      return this._schemaDataSource._schema;
    }
    
    // For other formats, construct JSON Schema from introspection
    const schema = {
      type: this.getSchemaType()
    };
    
    const metadata = this.getMetadata();
    Object.assign(schema, metadata);
    
    if (schema.type === 'object') {
      const properties = this.getProperties();
      if (properties.length > 0) {
        schema.properties = {};
        properties.forEach(prop => {
          schema.properties[prop.name] = prop.schema || { type: prop.type };
        });
      }
      
      const required = this.getRequiredProperties();
      if (required.length > 0) {
        schema.required = required;
      }
      
      const constraints = this.getConstraints();
      Object.assign(schema, constraints);
    }
    
    return schema;
  }
  
  /**
   * Check if schema has a specific entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Entity type name
   * @returns {boolean} True if entity type exists
   */
  hasEntityType(typeName) {
    const entityTypes = this.getEntityTypes();
    return entityTypes.includes(typeName);
  }
  
  /**
   * Check if entity type has a specific property
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} propertyName - Property name
   * @returns {boolean} True if property exists
   */
  hasProperty(entityType, propertyName) {
    const properties = this.getProperties(entityType);
    return properties.some(prop => prop.name === propertyName);
  }
  
  /**
   * Get property schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} entityType - Entity type name (optional)
   * @param {string} propertyName - Property name
   * @returns {Object|null} Property schema or null if not found
   */
  getPropertySchema(entityType, propertyName) {
    const properties = this.getProperties(entityType);
    const property = properties.find(prop => prop.name === propertyName);
    return property ? property.schema : null;
  }
  
  /**
   * Create SchemaHandle from a DataSource's schema
   * This is the key integration point with DataSource.getSchema()
   * 
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} dataSource - DataSource with getSchema() method
   * @param {Object} options - Optional configuration
   * @returns {SchemaHandle} SchemaHandle wrapping the DataSource's schema
   */
  static fromDataSource(dataSource, options = {}) {
    if (!dataSource || typeof dataSource.getSchema !== 'function') {
      throw new Error('DataSource must have getSchema() method');
    }
    
    // Get schema from DataSource (synchronous)
    const schema = dataSource.getSchema();
    
    if (!schema) {
      throw new Error('DataSource returned null or undefined schema');
    }
    
    // Create SchemaHandle wrapping the schema
    // Don't override format unless explicitly provided
    return new SchemaHandle(schema, options);
  }
}