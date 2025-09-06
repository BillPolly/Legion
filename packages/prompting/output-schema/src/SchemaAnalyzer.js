/**
 * SchemaAnalyzer - Intelligent analysis of JSON Schema for prompt generation
 * 
 * Analyzes schema structure to extract field information, constraints, and 
 * validation rules for generating optimal prompt instructions
 */

export class SchemaAnalyzer {
  /**
   * Analyze a JSON Schema to extract structured information
   * @param {Object} schema - JSON Schema to analyze
   * @returns {Object} Analysis result with fields, constraints, and format specs
   */
  static analyzeSchema(schema) {
    const analysis = {
      fields: {},
      requiredFields: [],
      optionalFields: [],
      formatSpecs: {},
      validationRules: []
    };

    // Extract basic schema information
    if (schema.required) {
      analysis.requiredFields = [...schema.required];
    }

    // Extract format specifications
    if (schema['x-format']) {
      analysis.formatSpecs = { ...schema['x-format'] };
    }

    // Analyze properties
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        analysis.fields[fieldName] = this._analyzeField(fieldName, fieldSchema, schema.required);
        
        if (!analysis.requiredFields.includes(fieldName)) {
          analysis.optionalFields.push(fieldName);
        }
      }
    }

    // Extract validation rules
    analysis.validationRules = this.extractValidationRules(schema);

    return analysis;
  }

  /**
   * Generate type hint for a schema property
   * @param {Object} propSchema - Property schema
   * @returns {string} Type hint string
   */
  static generateTypeHint(propSchema) {
    if (propSchema.enum) {
      return `<${propSchema.type}: ${propSchema.enum.join(' | ')}>`;
    }

    switch (propSchema.type) {
      case 'string':
        if (propSchema.minLength !== undefined || propSchema.maxLength !== undefined) {
          const min = propSchema.minLength || 0;
          const max = propSchema.maxLength || 'any';
          return `<string: length ${min}-${max}>`;
        }
        if (propSchema.format) {
          return `<string: ${propSchema.format} format>`;
        }
        return '<string>';
        
      case 'number':
        if (propSchema.minimum !== undefined || propSchema.maximum !== undefined) {
          const min = propSchema.minimum ?? propSchema.exclusiveMinimum ?? 'any';
          const max = propSchema.maximum ?? propSchema.exclusiveMaximum ?? 'any';
          return `<number: ${min}-${max}>`;
        }
        return '<number>';
        
      case 'boolean':
        return '<boolean>';
        
      case 'array':
        const itemHint = this.generateTypeHint(propSchema.items || { type: 'any' });
        let arrayHint = `[${itemHint}, ...]`;
        
        if (propSchema.maxItems !== undefined) {
          arrayHint += ` // Max ${propSchema.maxItems} items`;
        }
        
        return arrayHint;
        
      case 'object':
        return '<object>';
        
      default:
        return '<value>';
    }
  }

  /**
   * Extract validation rules from schema
   * @param {Object} schema - JSON Schema
   * @returns {string[]} Array of validation rule descriptions
   */
  static extractValidationRules(schema) {
    const rules = [];

    // Required fields
    if (schema.required?.length > 0) {
      rules.push(`Required fields: ${schema.required.join(', ')}`);
    }

    // Property-specific rules
    if (schema.properties) {
      for (const [fieldName, propSchema] of Object.entries(schema.properties)) {
        // Number constraints
        if (propSchema.type === 'number') {
          if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
            rules.push(`${fieldName} must be between ${propSchema.minimum} and ${propSchema.maximum}`);
          } else if (propSchema.minimum !== undefined) {
            rules.push(`${fieldName} must be at least ${propSchema.minimum}`);
          } else if (propSchema.maximum !== undefined) {
            rules.push(`${fieldName} must be at most ${propSchema.maximum}`);
          }
        }

        // String constraints
        if (propSchema.type === 'string') {
          if (propSchema.format) {
            rules.push(`${fieldName} must be valid ${propSchema.format} format`);
          }
          if (propSchema.pattern) {
            rules.push(`${fieldName} must match pattern: ${propSchema.pattern}`);
          }
          if (propSchema.minLength !== undefined || propSchema.maxLength !== undefined) {
            const min = propSchema.minLength || 0;
            const max = propSchema.maxLength || 'unlimited';
            rules.push(`${fieldName} length must be ${min}-${max} characters`);
          }
        }

        // Array constraints
        if (propSchema.type === 'array') {
          if (propSchema.maxItems !== undefined) {
            rules.push(`${fieldName} array cannot exceed ${propSchema.maxItems} items`);
          }
          if (propSchema.minItems !== undefined && propSchema.minItems > 0) {
            rules.push(`${fieldName} array must contain at least ${propSchema.minItems} items`);
          }
          if (propSchema.uniqueItems) {
            rules.push(`${fieldName} array items must be unique`);
          }
        }

        // Enum constraints
        if (propSchema.enum) {
          rules.push(`${fieldName} must be one of: ${propSchema.enum.join(', ')}`);
        }
      }
    }

    return rules;
  }

  /**
   * Analyze individual field
   * @private
   */
  static _analyzeField(fieldName, fieldSchema, requiredFields = []) {
    const field = {
      type: fieldSchema.type,
      required: requiredFields.includes(fieldName),
      description: fieldSchema.description || null,
      constraints: this._extractConstraints(fieldSchema)
    };

    // Handle array items
    if (fieldSchema.type === 'array' && fieldSchema.items) {
      field.items = {
        type: fieldSchema.items.type,
        constraints: this._extractConstraints(fieldSchema.items)
      };
    }

    // Handle object properties
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      field.properties = {};
      for (const [propName, propSchema] of Object.entries(fieldSchema.properties)) {
        field.properties[propName] = this._analyzeField(propName, propSchema);
      }
    }

    return field;
  }

  /**
   * Extract constraints from property schema
   * @private
   */
  static _extractConstraints(propSchema) {
    const constraints = {};
    
    const constraintKeys = [
      'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
      'minLength', 'maxLength', 'pattern', 'format',
      'minItems', 'maxItems', 'uniqueItems', 'multipleOf',
      'enum', 'const'
    ];

    for (const key of constraintKeys) {
      if (propSchema.hasOwnProperty(key)) {
        constraints[key] = propSchema[key];
      }
    }

    return constraints;
  }
}