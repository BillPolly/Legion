/**
 * Property Definition - Represents a schema property in the knowledge graph
 * 
 * This class provides a high-level interface for working with property
 * definitions stored as KG triples. It handles querying property metadata,
 * constraints, and validation rules.
 */

export class PropertyDefinition {
  constructor(propertyId, kgEngine) {
    this.propertyId = propertyId;
    this.kg = kgEngine;
    this._cache = new Map();
  }

  /**
   * Get the property name
   * @returns {string} The property name
   */
  getName() {
    return this._getCachedValue('name', () => {
      const result = this.kg.query(this.propertyId, 'kg:propertyName', null);
      return result[0]?.[2] || null;
    });
  }

  /**
   * Get the data type of this property
   * @returns {string} The data type (e.g., 'kg:StringType', 'kg:NumberType')
   */
  getDataType() {
    return this._getCachedValue('dataType', () => {
      const result = this.kg.query(this.propertyId, 'kg:dataType', null);
      return result[0]?.[2] || null;
    });
  }

  /**
   * Check if this property is required
   * @returns {boolean} True if the property is required
   */
  isRequired() {
    return this._getCachedValue('required', () => {
      const result = this.kg.query(this.propertyId, 'kg:required', null);
      const value = result[0]?.[2];
      return value === true || value === 'true';
    });
  }

  /**
   * Get all constraints for this property
   * @returns {Object} Object containing all constraints
   */
  getConstraints() {
    return this._getCachedValue('constraints', () => {
      const constraints = {};
      
      // String constraints
      this._addConstraint(constraints, 'minLength', 'kg:minLength');
      this._addConstraint(constraints, 'maxLength', 'kg:maxLength');
      this._addConstraint(constraints, 'pattern', 'kg:pattern');
      this._addConstraint(constraints, 'format', 'kg:format');
      
      // Numeric constraints
      this._addConstraint(constraints, 'minimum', 'kg:minimum');
      this._addConstraint(constraints, 'maximum', 'kg:maximum');
      this._addConstraint(constraints, 'exclusiveMinimum', 'kg:exclusiveMinimum');
      this._addConstraint(constraints, 'exclusiveMaximum', 'kg:exclusiveMaximum');
      this._addConstraint(constraints, 'multipleOf', 'kg:multipleOf');
      
      // Array constraints
      this._addConstraint(constraints, 'minItems', 'kg:minItems');
      this._addConstraint(constraints, 'maxItems', 'kg:maxItems');
      this._addConstraint(constraints, 'uniqueItems', 'kg:uniqueItems');
      this._addConstraint(constraints, 'items', 'kg:items');
      
      // Enumeration constraint
      this._addConstraint(constraints, 'enum', 'kg:enum');
      
      return constraints;
    });
  }

  /**
   * Get a specific constraint value
   * @param {string} constraintName - The constraint name (e.g., 'minLength')
   * @returns {*} The constraint value or null if not set
   */
  getConstraint(constraintName) {
    const constraints = this.getConstraints();
    return constraints[constraintName] || null;
  }

  /**
   * Check if this property has a specific constraint
   * @param {string} constraintName - The constraint name
   * @returns {boolean} True if the constraint exists
   */
  hasConstraint(constraintName) {
    return this.getConstraint(constraintName) !== null;
  }

  /**
   * Get the schema that this property belongs to
   * @returns {string|null} The schema ID or null if not found
   */
  getSchema() {
    return this._getCachedValue('schema', () => {
      const result = this.kg.query(null, 'kg:hasProperty', this.propertyId);
      return result[0]?.[0] || null;
    });
  }

  /**
   * Get the property description/documentation
   * @returns {string|null} The description or null if not set
   */
  getDescription() {
    return this._getCachedValue('description', () => {
      const result = this.kg.query(this.propertyId, 'rdfs:comment', null);
      return result[0]?.[2] || null;
    });
  }

  /**
   * Get the property title/label
   * @returns {string|null} The title or null if not set
   */
  getTitle() {
    return this._getCachedValue('title', () => {
      const result = this.kg.query(this.propertyId, 'rdfs:label', null);
      return result[0]?.[2] || null;
    });
  }

  /**
   * Get default value for this property
   * @returns {*} The default value or null if not set
   */
  getDefaultValue() {
    return this._getCachedValue('defaultValue', () => {
      const result = this.kg.query(this.propertyId, 'kg:defaultValue', null);
      return result[0]?.[2] || null;
    });
  }

  /**
   * Check if this property is deprecated
   * @returns {boolean} True if the property is deprecated
   */
  isDeprecated() {
    return this._getCachedValue('deprecated', () => {
      const result = this.kg.query(this.propertyId, 'kg:deprecated', null);
      const value = result[0]?.[2];
      return value === true || value === 'true';
    });
  }

  /**
   * Get examples for this property
   * @returns {Array} Array of example values
   */
  getExamples() {
    return this._getCachedValue('examples', () => {
      const result = this.kg.query(this.propertyId, 'kg:examples', null);
      if (result.length === 0) return [];
      
      // Handle both single values and arrays
      const examples = result.map(([,, value]) => value);
      return examples.length === 1 && Array.isArray(examples[0]) ? examples[0] : examples;
    });
  }

  /**
   * Convert this property definition to a JSON Schema property
   * @returns {Object} JSON Schema property object
   */
  toJSONSchemaProperty() {
    const property = {};
    
    // Basic type
    const dataType = this.getDataType();
    if (dataType) {
      property.type = this._mapDataTypeToJSONSchema(dataType);
    }
    
    // Add constraints
    const constraints = this.getConstraints();
    Object.entries(constraints).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        property[key] = value;
      }
    });
    
    // Add metadata
    const title = this.getTitle();
    if (title) property.title = title;
    
    const description = this.getDescription();
    if (description) property.description = description;
    
    const defaultValue = this.getDefaultValue();
    if (defaultValue !== null) property.default = defaultValue;
    
    const examples = this.getExamples();
    if (examples.length > 0) property.examples = examples;
    
    const deprecated = this.isDeprecated();
    if (deprecated) property.deprecated = true;
    
    return property;
  }

  /**
   * Validate a value against this property definition
   * @param {*} value - The value to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validate(value) {
    const errors = [];
    const dataType = this.getDataType();
    const constraints = this.getConstraints();
    
    // Type validation
    if (!this._validateType(value, dataType)) {
      errors.push({
        type: 'type_mismatch',
        message: `Expected ${this._mapDataTypeToJSONSchema(dataType)}, got ${typeof value}`,
        expected: this._mapDataTypeToJSONSchema(dataType),
        actual: typeof value
      });
    }
    
    // Constraint validation
    if (errors.length === 0) { // Only validate constraints if type is correct
      this._validateConstraints(value, constraints, errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      propertyId: this.propertyId,
      propertyName: this.getName()
    };
  }

  /**
   * Get all triples that define this property
   * @returns {Array<Array>} Array of [subject, predicate, object] triples
   */
  getTriples() {
    const triples = [];
    
    // Get all triples where this property is the subject
    const subjectTriples = this.kg.query(this.propertyId, null, null);
    triples.push(...subjectTriples);
    
    // Get triples where this property is referenced
    const objectTriples = this.kg.query(null, null, this.propertyId);
    triples.push(...objectTriples);
    
    return triples;
  }

  /**
   * Clear the internal cache
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Get the property ID
   * @returns {string} The property ID
   */
  getId() {
    return this.propertyId;
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
    const result = this.kg.query(this.propertyId, kgPredicate, null);
    if (result.length > 0) {
      let value = result[0][2];
      
      // Handle special cases
      if (constraintName === 'enum' && typeof value === 'string') {
        // Parse enum values if stored as JSON string
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If not JSON, treat as single value array
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
    
    return typeMap[kgDataType] || 'string';
  }

  /**
   * Validate value type
   * @private
   */
  _validateType(value, dataType) {
    const expectedType = this._mapDataTypeToJSONSchema(dataType);
    
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
   * Validate constraints
   * @private
   */
  _validateConstraints(value, constraints, errors) {
    const valueType = typeof value;
    
    // String constraints
    if (valueType === 'string') {
      if (constraints.minLength !== undefined && value.length < constraints.minLength) {
        errors.push({
          type: 'min_length_violation',
          message: `String length ${value.length} is less than minimum ${constraints.minLength}`,
          constraint: 'minLength',
          expected: constraints.minLength,
          actual: value.length
        });
      }
      
      if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
        errors.push({
          type: 'max_length_violation',
          message: `String length ${value.length} exceeds maximum ${constraints.maxLength}`,
          constraint: 'maxLength',
          expected: constraints.maxLength,
          actual: value.length
        });
      }
      
      if (constraints.pattern) {
        const regex = new RegExp(constraints.pattern);
        if (!regex.test(value)) {
          errors.push({
            type: 'pattern_violation',
            message: `String '${value}' does not match pattern ${constraints.pattern}`,
            constraint: 'pattern',
            expected: constraints.pattern,
            actual: value
          });
        }
      }
    }
    
    // Numeric constraints
    if (valueType === 'number') {
      if (constraints.minimum !== undefined && value < constraints.minimum) {
        errors.push({
          type: 'minimum_violation',
          message: `Value ${value} is less than minimum ${constraints.minimum}`,
          constraint: 'minimum',
          expected: constraints.minimum,
          actual: value
        });
      }
      
      if (constraints.maximum !== undefined && value > constraints.maximum) {
        errors.push({
          type: 'maximum_violation',
          message: `Value ${value} exceeds maximum ${constraints.maximum}`,
          constraint: 'maximum',
          expected: constraints.maximum,
          actual: value
        });
      }
      
      if (constraints.exclusiveMinimum !== undefined && value <= constraints.exclusiveMinimum) {
        errors.push({
          type: 'exclusive_minimum_violation',
          message: `Value ${value} is not greater than exclusive minimum ${constraints.exclusiveMinimum}`,
          constraint: 'exclusiveMinimum',
          expected: constraints.exclusiveMinimum,
          actual: value
        });
      }
      
      if (constraints.exclusiveMaximum !== undefined && value >= constraints.exclusiveMaximum) {
        errors.push({
          type: 'exclusive_maximum_violation',
          message: `Value ${value} is not less than exclusive maximum ${constraints.exclusiveMaximum}`,
          constraint: 'exclusiveMaximum',
          expected: constraints.exclusiveMaximum,
          actual: value
        });
      }
      
      if (constraints.multipleOf !== undefined && value % constraints.multipleOf !== 0) {
        errors.push({
          type: 'multiple_of_violation',
          message: `Value ${value} is not a multiple of ${constraints.multipleOf}`,
          constraint: 'multipleOf',
          expected: constraints.multipleOf,
          actual: value
        });
      }
    }
    
    // Array constraints
    if (Array.isArray(value)) {
      if (constraints.minItems !== undefined && value.length < constraints.minItems) {
        errors.push({
          type: 'min_items_violation',
          message: `Array length ${value.length} is less than minimum ${constraints.minItems}`,
          constraint: 'minItems',
          expected: constraints.minItems,
          actual: value.length
        });
      }
      
      if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
        errors.push({
          type: 'max_items_violation',
          message: `Array length ${value.length} exceeds maximum ${constraints.maxItems}`,
          constraint: 'maxItems',
          expected: constraints.maxItems,
          actual: value.length
        });
      }
      
      if (constraints.uniqueItems === true) {
        const uniqueValues = new Set(value.map(v => JSON.stringify(v)));
        if (uniqueValues.size !== value.length) {
          errors.push({
            type: 'unique_items_violation',
            message: 'Array contains duplicate items',
            constraint: 'uniqueItems',
            expected: true,
            actual: false
          });
        }
      }
    }
    
    // Enumeration constraint
    if (constraints.enum && Array.isArray(constraints.enum)) {
      if (!constraints.enum.includes(value)) {
        errors.push({
          type: 'enum_violation',
          message: `Value '${value}' is not in allowed values: ${constraints.enum.join(', ')}`,
          constraint: 'enum',
          expected: constraints.enum,
          actual: value
        });
      }
    }
  }
}

export default PropertyDefinition;
