/**
 * SchemaDataSource - DataSource implementation for schema introspection
 * 
 * This DataSource makes schemas themselves queryable and updatable through the Handle interface.
 * It wraps schema objects (JSON Schema, TypeScript interfaces, or custom schema formats)
 * and provides query/update/validate operations on schema structure.
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { validateDataSourceInterface } from '../DataSource.js';
import { PrototypeFactory } from '../PrototypeFactory.js';

export class SchemaDataSource {
  /**
   * Create a SchemaDataSource wrapping a schema object
   * 
   * @param {Object} schema - The schema object to wrap
   * @param {Object} options - Configuration options
   * @param {string} options.format - Schema format: 'json-schema', 'typescript', 'custom' (default: 'json-schema')
   */
  constructor(schema, options = {}) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object');
    }
    
    // Store the wrapped schema
    this._schema = schema;
    this._format = options.format || this._detectFormat(schema);
    
    // Track subscriptions for schema change notifications
    this._subscriptions = new Map();
    this._subscriptionId = 0;
    
    // Track modification listeners
    this._modificationListeners = new Set();
    
    // Create PrototypeFactory for schema analysis
    this._prototypeFactory = new PrototypeFactory();
    
    // Analyze schema with PrototypeFactory to extract types and properties
    this._analysisResult = null;
    try {
      // For MongoDB-style schemas with collections, analyze each collection as DataScript
      if (this._schema.collections) {
        const mergedSchema = {};
        for (const [collName, collSchema] of Object.entries(this._schema.collections)) {
          Object.assign(mergedSchema, collSchema);
        }
        this._analysisResult = this._prototypeFactory.analyzeSchema(mergedSchema, 'datascript');
      } else {
        this._analysisResult = this._prototypeFactory.analyzeSchema(this._schema, this._format);
      }
    } catch (error) {
      // If analysis fails, continue without it
      console.warn('Schema analysis failed:', error.message);
    }
    
    // Validate that we implement the DataSource interface
    validateDataSourceInterface(this, 'SchemaDataSource');
  }
  
  /**
   * REQUIRED: Execute query against the schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification
   * @returns {*} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    const { type, entityType, filter } = querySpec;
    
    switch (type) {
      case 'entity-types':
        return this._getEntityTypes();
        
      case 'properties':
        return this._getProperties(entityType);
        
      case 'relationships':
        return this._getRelationships(entityType);
        
      case 'constraints':
        return this._getConstraints(entityType);
        
      case 'required-properties':
        return this._getRequiredProperties(entityType);
        
      case 'schema-type':
        return this._getSchemaType();
        
      case 'schema-metadata':
        return this._getSchemaMetadata();
        
      case 'validation-rules':
        return this._getValidationRules(entityType);
        
      case 'nested-schemas':
        return this._getNestedSchemas(entityType);
        
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  
  /**
   * REQUIRED: Set up subscription for schema changes
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
    // Also track as modification listener
    const listener = {
      id: subscriptionId,
      querySpec,
      callback
    };
    this._modificationListeners.add(listener);
    
    // Return combined unsubscribe
    return {
      id: subscriptionId,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._modificationListeners.delete(listener);
      }
    };
  }
  
  /**
   * REQUIRED: Get schema of the schema (meta-schema)
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Object} Schema describing the schema structure
   */
  getSchema() {
    return {
      type: 'object',
      description: 'Schema introspection interface',
      properties: {
        format: { type: 'string', enum: ['json-schema', 'typescript', 'custom'] },
        entityTypes: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' },
        relationships: { type: 'array' },
        constraints: { type: 'object' }
      }
    };
  }
  
  /**
   * OPTIONAL: Update schema structure
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    const { type } = updateSpec;
    
    switch (type) {
      case 'add-entity-type':
        return this._addEntityType(updateSpec);
        
      case 'remove-entity-type':
        return this._removeEntityType(updateSpec);
        
      case 'add-property':
        return this._addProperty(updateSpec);
        
      case 'modify-property':
        return this._modifyProperty(updateSpec);
        
      case 'remove-property':
        return this._removeProperty(updateSpec);
        
      case 'add-relationship':
        return this._addRelationship(updateSpec);
        
      case 'remove-relationship':
        return this._removeRelationship(updateSpec);
        
      case 'add-constraint':
        return this._addConstraint(updateSpec);
        
      case 'remove-constraint':
        return this._removeConstraint(updateSpec);
        
      default:
        throw new Error(`Unknown update type: ${type}`);
    }
  }
  
  /**
   * OPTIONAL: Validate data against this schema
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {*} data - Data to validate
   * @returns {Object} Validation result with isValid, errors
   */
  validate(data) {
    const errors = [];
    
    // Basic type validation for JSON Schema format
    if (this._format === 'json-schema') {
      this._validateJSONSchema(data, this._schema, errors, '');
    } else {
      // For other formats, provide basic validation
      return {
        isValid: true,
        errors: [],
        message: `Validation not implemented for format: ${this._format}`
      };
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      schema: this._schema
    };
  }
  
  /**
   * REQUIRED: Create query builder for Handle
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    // Return a simple query builder for schema operations
    return {
      where: () => this,
      select: () => this,
      first: () => null,
      last: () => null,
      count: () => 0,
      toArray: () => []
    };
  }
  
  // Private implementation methods
  
  /**
   * Detect schema format from schema object
   * @private
   */
  _detectFormat(schema) {
    // JSON Schema detection
    if (schema.$schema || schema.type || schema.properties) {
      return 'json-schema';
    }
    
    // TypeScript interface detection
    if (schema.kind === 'interface' || schema.members) {
      return 'typescript';
    }
    
    return 'custom';
  }
  
  /**
   * Get all entity types from schema
   * @private
   */
  _getEntityTypes() {
    // For MongoDB-style schemas with collections
    if (this._schema.collections) {
      return Object.keys(this._schema.collections);
    }
    
    if (this._format === 'json-schema') {
      // For schemas with definitions, return definition names (higher priority)
      if (this._schema.definitions) {
        return Object.keys(this._schema.definitions);
      }
      
      // For object schemas, return property names as entity types
      if (this._schema.type === 'object' && this._schema.properties) {
        return Object.keys(this._schema.properties);
      }
      
      // Single type schema
      return [this._schema.title || 'Entity'];
    }
    
    return [];
  }
  
  /**
   * Get properties for an entity type
   * @private
   */
  _getProperties(entityType) {
    // If we have analysis result from PrototypeFactory, use it
    if (this._analysisResult && this._analysisResult.types) {
      // For MongoDB collections, map collection name to the analyzed type
      if (this._schema.collections && entityType) {
        // The collection name (e.g., 'users') maps to entity type (e.g., 'user')
        // Extract the singular form by removing trailing 's'
        const singularType = entityType.endsWith('s') ? entityType.slice(0, -1) : entityType;
        
        const typeInfo = this._analysisResult.types.get(singularType);
        if (typeInfo && typeInfo.attributes) {
          const properties = [];
          for (const [attrName, attrInfo] of typeInfo.attributes) {
            properties.push({
              name: attrName,
              type: attrInfo.type || 'string',
              description: attrInfo.description,
              required: attrInfo.required || false,
              schema: attrInfo.definition || attrInfo
            });
          }
          return properties;
        }
      }
      
      // Direct type lookup
      const typeInfo = this._analysisResult.types.get(entityType);
      if (typeInfo && typeInfo.attributes) {
        const properties = [];
        for (const [attrName, attrInfo] of typeInfo.attributes) {
          properties.push({
            name: attrName,
            type: attrInfo.type || 'string',
            description: attrInfo.description,
            required: attrInfo.required || false,
            schema: attrInfo.definition || attrInfo
          });
        }
        return properties;
      }
    }
    
    // Fallback to direct schema inspection for JSON Schema
    if (this._format === 'json-schema') {
      let schemaObj = this._schema;
      
      // If entityType specified, look in definitions or properties
      if (entityType) {
        if (this._schema.definitions && this._schema.definitions[entityType]) {
          schemaObj = this._schema.definitions[entityType];
        } else if (this._schema.properties && this._schema.properties[entityType]) {
          schemaObj = this._schema.properties[entityType];
        }
      }
      
      // Return properties
      if (schemaObj.properties) {
        return Object.entries(schemaObj.properties).map(([name, propSchema]) => ({
          name,
          type: propSchema.type,
          description: propSchema.description,
          required: schemaObj.required?.includes(name) || false,
          schema: propSchema
        }));
      }
    }
    
    return [];
  }
  
  /**
   * Get relationships for an entity type
   * @private
   */
  _getRelationships(entityType) {
    // In JSON Schema, relationships might be in custom extensions
    // or inferred from object/array properties
    const relationships = [];
    
    if (this._format === 'json-schema') {
      const properties = this._getProperties(entityType);
      
      for (const prop of properties) {
        // Object properties are potential relationships
        if (prop.type === 'object' && prop.schema.$ref) {
          relationships.push({
            name: prop.name,
            type: 'belongsTo',
            target: prop.schema.$ref.split('/').pop()
          });
        }
        
        // Array properties with object items are potential hasMany relationships
        if (prop.type === 'array' && prop.schema.items?.$ref) {
          relationships.push({
            name: prop.name,
            type: 'hasMany',
            target: prop.schema.items.$ref.split('/').pop()
          });
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Get constraints for an entity type
   * @private
   */
  _getConstraints(entityType) {
    const constraints = {};
    
    if (this._format === 'json-schema') {
      let schemaObj = this._schema;
      
      if (entityType && this._schema.definitions) {
        schemaObj = this._schema.definitions[entityType] || schemaObj;
      }
      
      // Collect various constraints
      if (schemaObj.minProperties !== undefined) constraints.minProperties = schemaObj.minProperties;
      if (schemaObj.maxProperties !== undefined) constraints.maxProperties = schemaObj.maxProperties;
      if (schemaObj.additionalProperties !== undefined) constraints.additionalProperties = schemaObj.additionalProperties;
      if (schemaObj.minItems !== undefined) constraints.minItems = schemaObj.minItems;
      if (schemaObj.maxItems !== undefined) constraints.maxItems = schemaObj.maxItems;
      if (schemaObj.uniqueItems !== undefined) constraints.uniqueItems = schemaObj.uniqueItems;
      if (schemaObj.pattern !== undefined) constraints.pattern = schemaObj.pattern;
      if (schemaObj.format !== undefined) constraints.format = schemaObj.format;
      if (schemaObj.minimum !== undefined) constraints.minimum = schemaObj.minimum;
      if (schemaObj.maximum !== undefined) constraints.maximum = schemaObj.maximum;
    }
    
    return constraints;
  }
  
  /**
   * Get required properties for an entity type
   * @private
   */
  _getRequiredProperties(entityType) {
    if (this._format === 'json-schema') {
      let schemaObj = this._schema;
      
      if (entityType && this._schema.definitions) {
        schemaObj = this._schema.definitions[entityType] || schemaObj;
      }
      
      return schemaObj.required || [];
    }
    
    return [];
  }
  
  /**
   * Get schema type
   * @private
   */
  _getSchemaType() {
    if (this._format === 'json-schema') {
      return this._schema.type || 'object';
    }
    
    return 'unknown';
  }
  
  /**
   * Get schema metadata
   * @private
   */
  _getSchemaMetadata() {
    const metadata = {
      format: this._format
    };
    
    if (this._format === 'json-schema') {
      if (this._schema.$id) metadata.id = this._schema.$id;
      if (this._schema.$schema) metadata.schemaVersion = this._schema.$schema;
      if (this._schema.title) metadata.title = this._schema.title;
      if (this._schema.description) metadata.description = this._schema.description;
      
      // Include custom metadata properties (like version)
      // These are non-standard JSON Schema properties that applications may add
      if (this._schema.version !== undefined) metadata.version = this._schema.version;
      if (this._schema.examples !== undefined) metadata.examples = this._schema.examples;
      if (this._schema.default !== undefined) metadata.default = this._schema.default;
      if (this._schema.deprecated !== undefined) metadata.deprecated = this._schema.deprecated;
      if (this._schema.readOnly !== undefined) metadata.readOnly = this._schema.readOnly;
      if (this._schema.writeOnly !== undefined) metadata.writeOnly = this._schema.writeOnly;
    }
    
    return metadata;
  }
  
  /**
   * Get validation rules
   * @private
   */
  _getValidationRules(entityType) {
    const rules = [];
    const properties = this._getProperties(entityType);
    
    for (const prop of properties) {
      if (prop.required) {
        rules.push({
          property: prop.name,
          rule: 'required',
          message: `${prop.name} is required`
        });
      }
      
      if (prop.schema.minLength) {
        rules.push({
          property: prop.name,
          rule: 'minLength',
          value: prop.schema.minLength,
          message: `${prop.name} must be at least ${prop.schema.minLength} characters`
        });
      }
      
      if (prop.schema.pattern) {
        rules.push({
          property: prop.name,
          rule: 'pattern',
          value: prop.schema.pattern,
          message: `${prop.name} must match pattern: ${prop.schema.pattern}`
        });
      }
    }
    
    return rules;
  }
  
  /**
   * Get nested schemas
   * @private
   */
  _getNestedSchemas(entityType) {
    const nested = [];
    
    if (this._format === 'json-schema') {
      const properties = this._getProperties(entityType);
      
      for (const prop of properties) {
        if (prop.type === 'object' || prop.type === 'array') {
          nested.push({
            property: prop.name,
            schema: prop.schema
          });
        }
      }
    }
    
    return nested;
  }
  
  /**
   * Add entity type to schema
   * @private
   */
  _addEntityType(updateSpec) {
    const { typeName, attributes } = updateSpec;
    
    if (!typeName || typeof typeName !== 'string') {
      throw new Error('Type name must be a non-empty string');
    }
    
    if (this._format === 'json-schema') {
      // Ensure definitions exist
      if (!this._schema.definitions) {
        this._schema.definitions = {};
      }
      
      // Add new entity type
      this._schema.definitions[typeName] = {
        type: 'object',
        properties: attributes || {},
        required: []
      };
      
      // Notify listeners
      this._notifyModification({
        type: 'entity-type-added',
        typeName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Add entity type not supported for format: ${this._format}`);
  }
  
  /**
   * Remove entity type from schema
   * @private
   */
  _removeEntityType(updateSpec) {
    const { typeName } = updateSpec;
    
    if (!typeName || typeof typeName !== 'string') {
      throw new Error('Type name must be a non-empty string');
    }
    
    if (this._format === 'json-schema' && this._schema.definitions) {
      if (!this._schema.definitions[typeName]) {
        throw new Error(`Entity type '${typeName}' does not exist`);
      }
      
      delete this._schema.definitions[typeName];
      
      // Notify listeners
      this._notifyModification({
        type: 'entity-type-removed',
        typeName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Remove entity type not supported for format: ${this._format}`);
  }
  
  /**
   * Add property to entity type
   * @private
   */
  _addProperty(updateSpec) {
    const { entityType, propertyName, propertySchema } = updateSpec;
    
    if (!propertyName || typeof propertyName !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    if (this._format === 'json-schema') {
      let targetSchema = this._schema;
      
      if (entityType && this._schema.definitions) {
        targetSchema = this._schema.definitions[entityType];
        if (!targetSchema) {
          throw new Error(`Entity type '${entityType}' does not exist`);
        }
      }
      
      if (!targetSchema.properties) {
        targetSchema.properties = {};
      }
      
      targetSchema.properties[propertyName] = propertySchema || { type: 'string' };
      
      // Notify listeners
      this._notifyModification({
        type: 'property-added',
        entityType,
        propertyName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Add property not supported for format: ${this._format}`);
  }
  
  /**
   * Modify property in entity type
   * @private
   */
  _modifyProperty(updateSpec) {
    const { entityType, propertyName, propertySchema } = updateSpec;
    
    if (!propertyName || typeof propertyName !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    if (this._format === 'json-schema') {
      let targetSchema = this._schema;
      
      if (entityType && this._schema.definitions) {
        targetSchema = this._schema.definitions[entityType];
        if (!targetSchema) {
          throw new Error(`Entity type '${entityType}' does not exist`);
        }
      }
      
      if (!targetSchema.properties || !targetSchema.properties[propertyName]) {
        throw new Error(`Property '${propertyName}' does not exist`);
      }
      
      targetSchema.properties[propertyName] = {
        ...targetSchema.properties[propertyName],
        ...propertySchema
      };
      
      // Notify listeners
      this._notifyModification({
        type: 'property-modified',
        entityType,
        propertyName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Modify property not supported for format: ${this._format}`);
  }
  
  /**
   * Remove property from entity type
   * @private
   */
  _removeProperty(updateSpec) {
    const { entityType, propertyName } = updateSpec;
    
    if (!propertyName || typeof propertyName !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    if (this._format === 'json-schema') {
      let targetSchema = this._schema;
      
      if (entityType && this._schema.definitions) {
        targetSchema = this._schema.definitions[entityType];
        if (!targetSchema) {
          throw new Error(`Entity type '${entityType}' does not exist`);
        }
      }
      
      if (!targetSchema.properties || !targetSchema.properties[propertyName]) {
        throw new Error(`Property '${propertyName}' does not exist`);
      }
      
      delete targetSchema.properties[propertyName];
      
      // Also remove from required if present
      if (targetSchema.required) {
        targetSchema.required = targetSchema.required.filter(p => p !== propertyName);
      }
      
      // Notify listeners
      this._notifyModification({
        type: 'property-removed',
        entityType,
        propertyName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Remove property not supported for format: ${this._format}`);
  }
  
  /**
   * Add relationship (stored as schema extension)
   * @private
   */
  _addRelationship(updateSpec) {
    const { source, target, relationship, relationshipType } = updateSpec;
    
    // For now, store relationships as custom extension
    if (!this._schema._relationships) {
      this._schema._relationships = [];
    }
    
    this._schema._relationships.push({
      source,
      target,
      relationship,
      type: relationshipType || 'belongsTo'
    });
    
    // Notify listeners
    this._notifyModification({
      type: 'relationship-added',
      source,
      target,
      relationship,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Remove relationship
   * @private
   */
  _removeRelationship(updateSpec) {
    const { source, target, relationship } = updateSpec;
    
    if (!this._schema._relationships) {
      throw new Error('No relationships defined');
    }
    
    const initialLength = this._schema._relationships.length;
    this._schema._relationships = this._schema._relationships.filter(rel =>
      !(rel.source === source && rel.target === target && rel.relationship === relationship)
    );
    
    if (this._schema._relationships.length === initialLength) {
      throw new Error(`Relationship '${relationship}' from '${source}' to '${target}' does not exist`);
    }
    
    // Notify listeners
    this._notifyModification({
      type: 'relationship-removed',
      source,
      target,
      relationship,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Add constraint to entity type
   * @private
   */
  _addConstraint(updateSpec) {
    const { entityType, constraintName, constraintValue } = updateSpec;
    
    if (this._format === 'json-schema') {
      let targetSchema = this._schema;
      
      if (entityType && this._schema.definitions) {
        targetSchema = this._schema.definitions[entityType];
        if (!targetSchema) {
          throw new Error(`Entity type '${entityType}' does not exist`);
        }
      }
      
      targetSchema[constraintName] = constraintValue;
      
      // Notify listeners
      this._notifyModification({
        type: 'constraint-added',
        entityType,
        constraintName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Add constraint not supported for format: ${this._format}`);
  }
  
  /**
   * Remove constraint from entity type
   * @private
   */
  _removeConstraint(updateSpec) {
    const { entityType, constraintName } = updateSpec;
    
    if (this._format === 'json-schema') {
      let targetSchema = this._schema;
      
      if (entityType && this._schema.definitions) {
        targetSchema = this._schema.definitions[entityType];
        if (!targetSchema) {
          throw new Error(`Entity type '${entityType}' does not exist`);
        }
      }
      
      if (!targetSchema[constraintName]) {
        throw new Error(`Constraint '${constraintName}' does not exist`);
      }
      
      delete targetSchema[constraintName];
      
      // Notify listeners
      this._notifyModification({
        type: 'constraint-removed',
        entityType,
        constraintName,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    throw new Error(`Remove constraint not supported for format: ${this._format}`);
  }
  
  /**
   * Notify all modification listeners
   * @private
   */
  _notifyModification(change) {
    for (const listener of this._modificationListeners) {
      try {
        listener.callback(change);
      } catch (error) {
        console.warn('SchemaDataSource modification listener error:', error);
      }
    }
  }
  
  /**
   * Validate data against JSON Schema
   * @private
   */
  _validateJSONSchema(data, schema, errors, path) {
    // Type validation
    if (schema.type) {
      let actualType = Array.isArray(data) ? 'array' : typeof data;
      // Handle integer type
      if (schema.type === 'integer' && typeof data === 'number') {
        if (!Number.isInteger(data)) {
          errors.push({
            field: path.replace(/^\//, '') || undefined,
            path: path || '/',
            message: `Expected integer, got non-integer number`,
            expected: 'integer',
            actual: data
          });
          return;
        }
      } else if (actualType !== schema.type) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path: path || '/',
          message: `Expected type ${schema.type}, got ${actualType}`,
          expected: schema.type,
          actual: actualType
        });
        return;
      }
    }
    
    // Object validation
    if ((schema.type === 'object' || !schema.type) && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // Required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in data)) {
            errors.push({
              field: required,
              path: path ? `${path}/${required}` : required,
              message: `Required property '${required}' is missing`,
              expected: 'present',
              actual: 'missing'
            });
          }
        }
      }
      
      // Property validation
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in data) {
            const propPath = path ? `${path}/${propName}` : propName;
            this._validateJSONSchema(data[propName], propSchema, errors, propPath);
          }
        }
      }
    }
    
    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path: path || '/',
          message: `Array has ${data.length} items, minimum is ${schema.minItems}`,
          expected: `>= ${schema.minItems}`,
          actual: data.length
        });
      }
      
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path: path || '/',
          message: `Array has ${data.length} items, maximum is ${schema.maxItems}`,
          expected: `<= ${schema.maxItems}`,
          actual: data.length
        });
      }
      
      if (schema.uniqueItems && data.length > 0) {
        const seen = new Set();
        for (let i = 0; i < data.length; i++) {
          const stringified = JSON.stringify(data[i]);
          if (seen.has(stringified)) {
            errors.push({
              field: path.replace(/^\//, '') || undefined,
              path: path || '/',
              message: 'Array contains duplicate items',
              expected: 'unique items',
              actual: 'duplicate found'
            });
            break;
          }
          seen.add(stringified);
        }
      }
      
      // Validate array items
      if (schema.items) {
        for (let i = 0; i < data.length; i++) {
          const itemPath = `${path}[${i}]`;
          this._validateJSONSchema(data[i], schema.items, errors, itemPath);
        }
      }
    }
    
    // String validation
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path,
          message: `String length ${data.length} is less than minimum ${schema.minLength}`,
          expected: `>= ${schema.minLength}`,
          actual: data.length
        });
      }
      
      if (schema.maxLength && data.length > schema.maxLength) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path,
          message: `String length ${data.length} exceeds maximum ${schema.maxLength}`,
          expected: `<= ${schema.maxLength}`,
          actual: data.length
        });
      }
      
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path,
          message: `String does not match pattern: ${schema.pattern}`,
          expected: schema.pattern,
          actual: data
        });
      }
      
      // Email format validation
      if (schema.format === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data)) {
          errors.push({
            field: path.replace(/^\//, '') || undefined,
            path,
            message: `String is not a valid email format`,
            expected: 'valid email',
            actual: data
          });
        }
      }
    }
    
    // Number/Integer validation
    if ((schema.type === 'number' || schema.type === 'integer') && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path,
          message: `Number ${data} is less than minimum ${schema.minimum}`,
          expected: `>= ${schema.minimum}`,
          actual: data
        });
      }
      
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          field: path.replace(/^\//, '') || undefined,
          path,
          message: `Number ${data} exceeds maximum ${schema.maximum}`,
          expected: `<= ${schema.maximum}`,
          actual: data
        });
      }
    }
  }
}