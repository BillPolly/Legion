/**
 * EntityType - Immutable entity type definition with schema validation
 * Per implementation plan Phase 4 Step 4.1
 * Provides entity type with attribute schemas, validation, type checking, and inheritance
 */

export class EntityType {
  constructor(name, schema = {}) {
    // Fail fast validation
    if (name === null || name === undefined) {
      throw new Error('Entity type name is required');
    }
    if (name === '') {
      throw new Error('Entity type name cannot be empty');
    }
    if (schema !== null && schema !== undefined && typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }

    // Initialize properties
    this.name = name;
    this.parent = null;
    this.required = Object.freeze(schema.required || []);
    this.optional = Object.freeze(schema.optional || []);
    this.types = Object.freeze(schema.types || {});
    this.nullable = Object.freeze(schema.nullable || []);
    this.constraints = Object.freeze(schema.constraints || {});

    // Freeze the instance
    Object.freeze(this);
  }

  /**
   * Validate an entity against this type's schema
   */
  validate(entity) {
    const errors = [];

    // Check required fields
    for (const field of this.required) {
      if (!(field in entity)) {
        errors.push({
          field,
          type: 'missing_required',
          message: `Required field "${field}" is missing`
        });
      }
    }

    // Get all expected fields
    const expectedFields = new Set([...this.required, ...this.optional]);

    // Check each field in entity
    for (const field in entity) {
      // Check for unexpected fields
      if (!expectedFields.has(field)) {
        errors.push({
          field,
          type: 'unexpected_field',
          message: `Unexpected field "${field}"`
        });
        continue;
      }

      // Check type if defined
      if (this.types[field]) {
        const value = entity[field];
        
        // Check if nullable
        if (value === null && this.nullable.includes(field)) {
          continue;
        }

        // Check type
        if (!this.checkType(value, this.types[field])) {
          const actualType = value === null ? 'null' : typeof value;
          const expectedType = this.types[field];
          
          errors.push({
            field,
            type: 'type_mismatch',
            message: `Field "${field}" should be of type "${expectedType}" but got "${actualType}"`,
            expected: expectedType,
            actual: actualType
          });
        }
      }

      // Check constraints
      if (this.constraints[field]) {
        const value = entity[field];
        const constraint = this.constraints[field];
        
        // Enum constraint
        if (constraint.enum && !constraint.enum.includes(value)) {
          errors.push({
            field,
            type: 'constraint_violation',
            message: `Field "${field}" value must be one of: ${constraint.enum.join(', ')}`
          });
        }

        // Range constraints
        if (typeof value === 'number') {
          if (constraint.min !== undefined && value < constraint.min) {
            errors.push({
              field,
              type: 'constraint_violation',
              message: `Field "${field}" value ${value} is below minimum ${constraint.min}`
            });
          }
          if (constraint.max !== undefined && value > constraint.max) {
            errors.push({
              field,
              type: 'constraint_violation',
              message: `Field "${field}" value ${value} exceeds maximum ${constraint.max}`
            });
          }
        }

        // Pattern constraint
        if (constraint.pattern && typeof value === 'string') {
          if (!constraint.pattern.test(value)) {
            errors.push({
              field,
              type: 'constraint_violation',
              message: `Field "${field}" value does not match required pattern`
            });
          }
        }

        // Custom constraint function
        if (constraint.custom) {
          if (!constraint.custom(value, entity)) {
            errors.push({
              field,
              type: 'constraint_violation',
              message: constraint.message || `Field "${field}" failed custom validation`
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: Object.freeze(errors)
    };
  }

  /**
   * Check if a value matches a type specification
   */
  checkType(value, typeSpec) {
    // If typeSpec is a field name, look it up in types
    if (typeof typeSpec === 'string' && this.types[typeSpec]) {
      typeSpec = this.types[typeSpec];
    }
    
    // Handle union types (array of types)
    if (Array.isArray(typeSpec)) {
      return typeSpec.some(type => this.checkType(value, type));
    }

    // Handle custom type validators (functions)
    if (typeof typeSpec === 'function') {
      return typeSpec(value);
    }

    // Handle basic types
    switch (typeSpec) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Create a new entity type that extends this one
   */
  extend(name, schema = {}) {
    // Merge schemas
    const mergedSchema = {
      required: [...this.required, ...(schema.required || [])],
      optional: [...this.optional, ...(schema.optional || [])],
      types: { ...this.types, ...(schema.types || {}) },
      nullable: [...this.nullable, ...(schema.nullable || [])],
      constraints: { ...this.constraints, ...(schema.constraints || {}) }
    };

    // Create extended type
    const extendedType = new EntityType(name, mergedSchema);
    
    // Set parent reference (need to work around immutability)
    const mutableExtended = Object.create(Object.getPrototypeOf(extendedType));
    Object.assign(mutableExtended, extendedType);
    mutableExtended.parent = this;
    
    // Re-freeze with parent
    Object.freeze(mutableExtended);
    
    return mutableExtended;
  }

  /**
   * Check if this type is a subtype of another type
   */
  isSubtypeOf(typeName) {
    // Check if this type matches
    if (this.name === typeName) {
      return true;
    }
    
    // Check parent chain
    let current = this.parent;
    while (current) {
      if (current.name === typeName) {
        return true;
      }
      current = current.parent;
    }
    
    return false;
  }

  /**
   * Get a summary of the schema
   */
  getSchemaSummary() {
    return {
      name: this.name,
      requiredCount: this.required.length,
      optionalCount: this.optional.length,
      totalFields: this.required.length + this.optional.length,
      fieldTypes: { ...this.types }
    };
  }

  /**
   * Check if an entity conforms to this type (simple validation check)
   */
  conforms(entity) {
    return this.validate(entity).isValid;
  }

  /**
   * String representation
   */
  toString() {
    return `EntityType(${this.name}, required: ${this.required.length}, optional: ${this.optional.length})`;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      name: this.name,
      required: [...this.required],
      optional: [...this.optional],
      types: { ...this.types },
      nullable: [...this.nullable],
      constraints: { ...this.constraints }
    };
  }
}