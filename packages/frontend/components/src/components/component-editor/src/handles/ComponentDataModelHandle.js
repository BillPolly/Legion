/**
 * ComponentDataModelHandle - Handle for component data models
 * Phase 1.3 (used by ComponentHandle)
 *
 * Provides access to component data schema and sample data
 */

export class ComponentDataModelHandle {
  constructor(dataModelData) {
    this._data = dataModelData;
  }

  /**
   * Get entity name
   */
  get entityName() {
    return this._data.entityName;
  }

  /**
   * Get schema definition
   */
  get schema() {
    return this._data.schema;
  }

  /**
   * Get sample data
   */
  get sampleData() {
    return this._data.sampleData;
  }

  /**
   * Add field to schema
   */
  addField(name, type, description) {
    if (!this._data.schema) {
      this._data.schema = {};
    }

    this._data.schema[name] = {
      type,
      description
    };

    return this;
  }

  /**
   * Remove field from schema
   */
  removeField(name) {
    if (this._data.schema && this._data.schema[name]) {
      delete this._data.schema[name];
    }

    // Also remove from sample data
    if (this._data.sampleData && this._data.sampleData[name]) {
      delete this._data.sampleData[name];
    }

    return this;
  }

  /**
   * Update field definition
   */
  updateField(name, updates) {
    if (this._data.schema && this._data.schema[name]) {
      this._data.schema[name] = {
        ...this._data.schema[name],
        ...updates
      };
    }

    return this;
  }

  /**
   * Update sample data
   */
  updateSampleData(data) {
    this._data.sampleData = {
      ...this._data.sampleData,
      ...data
    };

    return this;
  }

  /**
   * Validate data against schema
   */
  validateData(data) {
    const errors = [];

    // Check for required fields
    for (const [fieldName, fieldDef] of Object.entries(this._data.schema)) {
      if (fieldDef.required && !data.hasOwnProperty(fieldName)) {
        errors.push(`Field "${fieldName}" is required`);
      }
    }

    // Check data types
    for (const [fieldName, value] of Object.entries(data)) {
      const fieldDef = this._data.schema[fieldName];
      if (!fieldDef) {
        continue; // Unknown fields are allowed
      }

      const actualType = typeof value;
      const expectedType = fieldDef.type;

      // Type checking
      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field "${fieldName}" must be an array`);
      } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`Field "${fieldName}" must be an object`);
      } else if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Field "${fieldName}" must be a string`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Field "${fieldName}" must be a number`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Field "${fieldName}" must be a boolean`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate sample data from schema
   */
  generateSampleData() {
    const sampleData = {};

    for (const [fieldName, fieldDef] of Object.entries(this._data.schema)) {
      // Generate sample values based on type
      switch (fieldDef.type) {
        case 'string':
          sampleData[fieldName] = `Sample ${fieldName}`;
          break;
        case 'number':
          sampleData[fieldName] = 0;
          break;
        case 'boolean':
          sampleData[fieldName] = false;
          break;
        case 'array':
          sampleData[fieldName] = [];
          break;
        case 'object':
          sampleData[fieldName] = {};
          break;
        case 'date':
          sampleData[fieldName] = new Date().toISOString();
          break;
        default:
          sampleData[fieldName] = null;
      }
    }

    this._data.sampleData = sampleData;
    return sampleData;
  }
}
