/**
 * Schema Definition - Represents a complete schema in the knowledge graph
 * 
 * This class provides a high-level interface for working with schema
 * definitions stored as KG triples. It handles querying schema metadata,
 * properties, constraints, and provides validation capabilities.
 */

import { PropertyDefinition } from './PropertyDefinition.js';

export class SchemaDefinition {
  constructor(schemaId, kgEngine) {
    this.schemaId = schemaId;
    this.kg = kgEngine;
    this._cache = new Map();
  }

  /**
   * Get all properties defined in this schema
   * @returns {PropertyDefinition[]} Array of property definitions
   */
  getProperties() {
    return this._getCachedValue('properties', () => {
      const propertyTriples = this.kg.query(this.schemaId, 'kg:hasProperty', null);
      return propertyTriples.map(([,, propId]) => 
        new PropertyDefinition(propId, this.kg)
      );
    });
  }

  /**
   * Get a specific property by name
   * @param {string} propertyName - The property name
   * @returns {PropertyDefinition|null} The property definition or null if not found
   */
  getProperty(propertyName) {
    const properties = this.getProperties();
    return properties.find(prop => prop.getName() === propertyName) || null;
  }

  /**
   * Get the schema type (e.g., 'object', 'array', 'string')
   * @returns {string} The schema type
   */
  getSchemaType() {
    return this._getCachedValue('schemaType', () => {
      const result = this.kg.query(this.schemaId, 'kg:schemaType', null);
      const kgType = result[0]?.[2];
      return this._mapDataTypeToJSONSchema(kgType) || 'object';
    });
  }

  /**
   * Get required property names
   * @returns {string[]} Array of required property names
   */
  getRequiredProperties() {
    return this._getCachedValue('requiredProperties', () => {
      const properties = this.getProperties();
      return properties
        .filter(prop => prop.isRequired())
        .map(prop => prop.getName())
        .filter(name => name !== null);
    });
  }

  /**
   * Check if additional properties are allowed
   * @returns {boolean} True if additional properties are allowed
   */
  allowsAdditionalProperties() {
    return this._getCachedValue('additionalProperties', () => {
      const result = this.kg.query(this.schemaId, 'kg:additionalProperties', null);
      const value = result[0]?.[2];
      // Default to true if not specified (JSON Schema default)
      return value === undefined ? true : (value === true || value === 'true');
    });
  }

  /**
   * Get schema constraints (minProperties, maxProperties, etc.)
   * @returns {Object} Object containing schema-level constraints
   */
  getConstraints() {
    return this._getCachedValue('constraints', () => {
      const constraints = {};
      
      // Object constraints
      this._addConstraint(constraints, 'minProperties', 'kg:minProperties');
      this._addConstraint(constraints, 'maxProperties', 'kg:maxProperties');
      
      // Array constraints (if schema type is array)
      this._addConstraint(constraints, 'minItems', 'kg:minItems');
      this._addConstraint(constraints, 'maxItems', 'kg:maxItems');
      this._addConstraint(constraints, 'uniqueItems', 'kg:uniqueItems');
      
      // String constraints (if schema type is string)
      this._addConstraint(constraints, 'minLength', 'kg:minLength');
      this._addConstraint(constraints, 'maxLength', 'kg:maxLength');
      this._addConstraint(constraints, 'pattern', 'kg:pattern');
      this._addConstraint(constraints, 'format', 'kg:format');
      
      // Numeric constraints (if schema type is number/integer)
      this._addConstraint(constraints, 'minimum', 'kg:minimum');
      this._addConstraint(constraints, 'maximum', 'kg:maximum');
      this._addConstraint(constraints, 'exclusiveMinimum', 'kg:exclusiveMinimum');
      this._addConstraint(constraints, 'exclusiveMaximum', 'kg:exclusiveMaximum');
      this._addConstraint(constraints, 'multipleOf', 'kg:multipleOf');
      
      // Enumeration constraint
      this._addConstraint(constraints, 'enum', 'kg:enum');
      
      return constraints;
    });
  }

  /**
   * Get schema metadata (title, description, etc.)
   * @returns {Object} Object containing schema metadata
   */
  getMetadata() {
    return this._getCachedValue('metadata', () => {
      const metadata = {};
      
      // Basic metadata
      const title = this.kg.query(this.schemaId, 'rdfs:label', null)[0]?.[2];
      if (title) metadata.title = title;
      
      const description = this.kg.query(this.schemaId, 'rdfs:comment', null)[0]?.[2];
      if (description) metadata.description = description;
      
      // Schema version
      const version = this.kg.query(this.schemaId, 'kg:version', null)[0]?.[2];
      if (version) metadata.version = version;
      
      // Schema ID/URI
      const schemaUri = this.kg.query(this.schemaId, 'kg:schemaUri', null)[0]?.[2];
      if (schemaUri) metadata.$id = schemaUri;
      
      // Schema format
      const format = this.kg.query(this.schemaId, 'kg:schemaFormat', null)[0]?.[2];
      if (format) metadata.$schema = format;
      
      // Examples
      const examples = this.kg.query(this.schemaId, 'kg:examples', null);
      if (examples.length > 0) {
        metadata.examples = examples.map(([,, value]) => value);
      }
      
      // Default value
      const defaultValue = this.kg.query(this.schemaId, 'kg:defaultValue', null)[0]?.[2];
      if (defaultValue !== undefined) metadata.default = defaultValue;
      
      return metadata;
    });
  }

  /**
   * Get schema composition (allOf, oneOf, anyOf, not)
   * @returns {Object} Object containing composition rules
   */
  getComposition() {
    return this._getCachedValue('composition', () => {
      const composition = {};
      
      // Get composition rules
      const allOf = this.kg.query(this.schemaId, 'kg:allOf', null);
      if (allOf.length > 0) {
        composition.allOf = allOf.map(([,, schemaRef]) => schemaRef);
      }
      
      const oneOf = this.kg.query(this.schemaId, 'kg:oneOf', null);
      if (oneOf.length > 0) {
        composition.oneOf = oneOf.map(([,, schemaRef]) => schemaRef);
      }
      
      const anyOf = this.kg.query(this.schemaId, 'kg:anyOf', null);
      if (anyOf.length > 0) {
        composition.anyOf = anyOf.map(([,, schemaRef]) => schemaRef);
      }
      
      const not = this.kg.query(this.schemaId, 'kg:not', null)[0]?.[2];
      if (not) composition.not = not;
      
      return composition;
    });
  }

  /**
   * Get conditional schema rules (if/then/else)
   * @returns {Object} Object containing conditional rules
   */
  getConditionals() {
    return this._getCachedValue('conditionals', () => {
      const conditionals = {};
      
      const ifSchema = this.kg.query(this.schemaId, 'kg:if', null)[0]?.[2];
      if (ifSchema) {
        conditionals.if = ifSchema;
        
        const thenSchema = this.kg.query(this.schemaId, 'kg:then', null)[0]?.[2];
        if (thenSchema) conditionals.then = thenSchema;
        
        const elseSchema = this.kg.query(this.schemaId, 'kg:else', null)[0]?.[2];
        if (elseSchema) conditionals.else = elseSchema;
      }
      
      return conditionals;
    });
  }

  /**
   * Check if this schema is valid (has required structure)
   * @returns {boolean} True if the schema is valid
   */
  isValid() {
    try {
      // Check if schema has a type
      const schemaType = this.getSchemaType();
      if (!schemaType) return false;
      
      // Check if object schemas have valid properties
      if (schemaType === 'object') {
        const properties = this.getProperties();
        // Validate each property
        for (const property of properties) {
          if (!property.getName() || !property.getDataType()) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert this schema definition to a JSON Schema object
   * @returns {Object} JSON Schema object
   */
  toJSONSchema() {
    const schema = {};
    
    // Add metadata
    const metadata = this.getMetadata();
    Object.assign(schema, metadata);
    
    // Add type
    const schemaType = this.getSchemaType();
    schema.type = schemaType;
    
    // Add constraints
    const constraints = this.getConstraints();
    Object.entries(constraints).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        schema[key] = value;
      }
    });
    
    // Add properties for object schemas
    if (schemaType === 'object') {
      const properties = this.getProperties();
      if (properties.length > 0) {
        schema.properties = {};
        properties.forEach(prop => {
          const propName = prop.getName();
          if (propName) {
            schema.properties[propName] = prop.toJSONSchemaProperty();
          }
        });
      }
      
      // Add required properties
      const required = this.getRequiredProperties();
      if (required.length > 0) {
        schema.required = required;
      }
      
      // Add additionalProperties
      const additionalProps = this.allowsAdditionalProperties();
      if (!additionalProps) {
        schema.additionalProperties = false;
      }
    }
    
    // Add composition rules
    const composition = this.getComposition();
    Object.assign(schema, composition);
    
    // Add conditional rules
    const conditionals = this.getConditionals();
    Object.assign(schema, conditionals);
    
    return schema;
  }

  /**
   * Validate an object against this schema
   * @param {*} object - The object to validate
   * @returns {Object} Validation result
   */
  validate(object) {
    const errors = [];
    const schemaType = this.getSchemaType();
    
    // Type validation
    if (!this._validateType(object, schemaType)) {
      errors.push({
        type: 'type_mismatch',
        path: '',
        message: `Expected ${schemaType}, got ${typeof object}`,
        expected: schemaType,
        actual: typeof object
      });
      
      // Return early if type is wrong
      return {
        isValid: false,
        errors,
        conformanceScore: 0,
        schemaId: this.schemaId
      };
    }
    
    // Schema-level constraint validation
    this._validateSchemaConstraints(object, errors);
    
    // Property validation for object schemas
    if (schemaType === 'object' && typeof object === 'object' && object !== null) {
      this._validateObjectProperties(object, errors);
    }
    
    // Calculate conformance score
    const conformanceScore = this._calculateConformanceScore(errors);
    
    return {
      isValid: errors.length === 0,
      errors,
      conformanceScore,
      schemaId: this.schemaId
    };
  }

  /**
   * Get all triples that define this schema
   * @returns {Array<Array>} Array of [subject, predicate, object] triples
   */
  getTriples() {
    const triples = [];
    
    // Get all triples where this schema is the subject
    const subjectTriples = this.kg.query(this.schemaId, null, null);
    triples.push(...subjectTriples);
    
    // Get triples for all properties
    const properties = this.getProperties();
    properties.forEach(prop => {
      triples.push(...prop.getTriples());
    });
    
    return triples;
  }

  /**
   * Clear the internal cache
   */
  clearCache() {
    this._cache.clear();
    // Also clear property caches
    const properties = this.getProperties();
    properties.forEach(prop => prop.clearCache());
  }

  /**
   * Get the schema ID
   * @returns {string} The schema ID
   */
  getId() {
    return this.schemaId;
  }

  /**
   * Get property names
   * @returns {string[]} Array of property names
   */
  getPropertyNames() {
    return this.getProperties()
      .map(prop => prop.getName())
      .filter(name => name !== null);
  }

  /**
   * Check if a property exists in this schema
   * @param {string} propertyName - The property name
   * @returns {boolean} True if the property exists
   */
  hasProperty(propertyName) {
    return this.getProperty(propertyName) !== null;
  }

  // Private helper methods

  /**
   * Get a cached value or compute it if not cached
   * @private
   */
  _getCachedValue(key, computeFn) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    
    const value = computeFn();
    this._cache.set(key, value);
    return value;
  }

  /**
   * Add a constraint to the constraints object if it exists
   * @private
   */
  _addConstraint(constraints, constraintName, kgPredicate) {
    const result = this.kg.query(this.schemaId, kgPredicate, null);
    if (result.length > 0) {
      let value = result[0][2];
      
      // Handle special cases
      if (constraintName === 'enum' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = [value];
        }
      }
      
      constraints[constraintName] = value;
    }
  }

  /**
   * Map KG data type to JSON Schema type
   * @private
   */
  _mapDataTypeToJSONSchema(kgDataType) {
    const typeMap = {
      'kg:StringType': 'string',
      'kg:NumberType': 'number',
      'kg:IntegerType': 'integer',
      'kg:BooleanType': 'boolean',
      'kg:NullType': 'null',
      'kg:ObjectType': 'object',
      'kg:ArrayType': 'array'
    };
    
    return typeMap[kgDataType] || null;
  }

  /**
   * Validate value type
   * @private
   */
  _validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true; // Unknown type, assume valid
    }
  }

  /**
   * Validate schema-level constraints
   * @private
   */
  _validateSchemaConstraints(object, errors) {
    const constraints = this.getConstraints();
    const schemaType = this.getSchemaType();
    
    if (schemaType === 'object' && typeof object === 'object' && object !== null) {
      const propCount = Object.keys(object).length;
      
      if (constraints.minProperties !== undefined && propCount < constraints.minProperties) {
        errors.push({
          type: 'min_properties_violation',
          path: '',
          message: `Object has ${propCount} properties, minimum is ${constraints.minProperties}`,
          expected: constraints.minProperties,
          actual: propCount
        });
      }
      
      if (constraints.maxProperties !== undefined && propCount > constraints.maxProperties) {
        errors.push({
          type: 'max_properties_violation',
          path: '',
          message: `Object has ${propCount} properties, maximum is ${constraints.maxProperties}`,
          expected: constraints.maxProperties,
          actual: propCount
        });
      }
    }
    
    if (schemaType === 'array' && Array.isArray(object)) {
      if (constraints.minItems !== undefined && object.length < constraints.minItems) {
        errors.push({
          type: 'min_items_violation',
          path: '',
          message: `Array has ${object.length} items, minimum is ${constraints.minItems}`,
          expected: constraints.minItems,
          actual: object.length
        });
      }
      
      if (constraints.maxItems !== undefined && object.length > constraints.maxItems) {
        errors.push({
          type: 'max_items_violation',
          path: '',
          message: `Array has ${object.length} items, maximum is ${constraints.maxItems}`,
          expected: constraints.maxItems,
          actual: object.length
        });
      }
      
      if (constraints.uniqueItems === true) {
        const uniqueValues = new Set(object.map(v => JSON.stringify(v)));
        if (uniqueValues.size !== object.length) {
          errors.push({
            type: 'unique_items_violation',
            path: '',
            message: 'Array contains duplicate items',
            expected: true,
            actual: false
          });
        }
      }
    }
    
    // Enumeration constraint
    if (constraints.enum && Array.isArray(constraints.enum)) {
      if (!constraints.enum.includes(object)) {
        errors.push({
          type: 'enum_violation',
          path: '',
          message: `Value is not in allowed values: ${constraints.enum.join(', ')}`,
          expected: constraints.enum,
          actual: object
        });
      }
    }
  }

  /**
   * Validate object properties
   * @private
   */
  _validateObjectProperties(object, errors) {
    const properties = this.getProperties();
    const objectKeys = Object.keys(object);
    const allowsAdditional = this.allowsAdditionalProperties();
    
    // Validate each defined property
    properties.forEach(prop => {
      const propName = prop.getName();
      if (!propName) return;
      
      if (prop.isRequired() && !(propName in object)) {
        errors.push({
          type: 'missing_required_property',
          path: propName,
          message: `Required property '${propName}' is missing`,
          expected: 'present',
          actual: 'missing'
        });
        return;
      }
      
      if (propName in object) {
        const propResult = prop.validate(object[propName]);
        if (!propResult.isValid) {
          propResult.errors.forEach(error => {
            errors.push({
              ...error,
              path: propName
            });
          });
        }
        
        // Handle nested object validation
        const propDataType = prop.getDataType();
        const propValue = object[propName];
        
        if (propDataType === 'kg:ObjectType' && typeof propValue === 'object' && propValue !== null && !Array.isArray(propValue)) {
          this._validateNestedObject(propValue, prop, errors, propName);
        } else if (propDataType === 'kg:ArrayType' && Array.isArray(propValue)) {
          this._validateArrayItems(propValue, prop, errors, propName);
        }
      }
    });
    
    // Check for unexpected properties
    if (!allowsAdditional) {
      const allowedProps = properties.map(p => p.getName()).filter(n => n !== null);
      const unexpectedProps = objectKeys.filter(key => !allowedProps.includes(key));
      
      unexpectedProps.forEach(prop => {
        errors.push({
          type: 'unexpected_property',
          path: prop,
          message: `Unexpected property '${prop}' not allowed by schema`,
          expected: 'not present',
          actual: 'present'
        });
      });
    }
  }

  /**
   * Validate nested object against its schema
   * @private
   */
  _validateNestedObject(nestedObject, parentProperty, errors, basePath) {
    // Look for nested schema reference
    const nestedSchemaTriples = this.kg.query(parentProperty.getId(), 'kg:nestedSchema', null);
    if (nestedSchemaTriples.length > 0) {
      const nestedSchemaId = nestedSchemaTriples[0][2];
      const nestedSchema = new SchemaDefinition(nestedSchemaId, this.kg);
      const nestedResult = nestedSchema.validate(nestedObject);
      
      if (!nestedResult.isValid) {
        nestedResult.errors.forEach(error => {
          errors.push({
            ...error,
            path: error.path ? `${basePath}.${error.path}` : basePath
          });
        });
      }
    }
  }

  /**
   * Validate array items against their schema
   * @private
   */
  _validateArrayItems(arrayValue, parentProperty, errors, basePath) {
    // Look for items schema reference
    const itemsSchemaTriples = this.kg.query(parentProperty.getId(), 'kg:items', null);
    if (itemsSchemaTriples.length > 0) {
      const itemsSchemaId = itemsSchemaTriples[0][2];
      const itemsSchema = new SchemaDefinition(itemsSchemaId, this.kg);
      
      arrayValue.forEach((item, index) => {
        const itemResult = itemsSchema.validate(item);
        if (!itemResult.isValid) {
          itemResult.errors.forEach(error => {
            errors.push({
              ...error,
              path: error.path ? `${basePath}[${index}].${error.path}` : `${basePath}[${index}]`
            });
          });
        }
      });
    }
  }

  /**
   * Calculate conformance score based on errors
   * @private
   */
  _calculateConformanceScore(errors) {
    if (errors.length === 0) return 1.0;
    
    const properties = this.getProperties();
    const totalProperties = Math.max(properties.length, 1);
    
    const errorWeight = errors.reduce((sum, error) => {
      switch (error.type) {
        case 'type_mismatch': return sum + 1.0;
        case 'missing_required_property': return sum + 0.8;
        case 'pattern_violation': return sum + 0.6;
        case 'min_length_violation':
        case 'max_length_violation':
        case 'minimum_violation':
        case 'maximum_violation': return sum + 0.5;
        case 'unexpected_property': return sum + 0.2;
        default: return sum + 0.4;
      }
    }, 0);
    
    return Math.max(0, 1 - (errorWeight / totalProperties));
  }
}

export default SchemaDefinition;
