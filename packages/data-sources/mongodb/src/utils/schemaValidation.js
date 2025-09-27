/**
 * Schema Validation Utilities
 * Validates data against MongoDB/JSON schemas
 */

/**
 * Validate data against a JSON Schema
 * @param {*} data - Data to validate
 * @param {Object} schema - JSON Schema to validate against
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateAgainstSchema(data, schema) {
  const errors = [];
  
  if (!schema) {
    return { valid: true, errors: [] };
  }
  
  // Validate type
  if (schema.type) {
    const actualType = getJsonSchemaType(data);
    
    if (schema.type === 'array' && !Array.isArray(data)) {
      errors.push({
        path: '',
        message: `Expected array but got ${actualType}`,
        expected: 'array',
        actual: actualType
      });
    } else if (schema.type !== 'array' && actualType !== schema.type) {
      // Handle oneOf if present
      if (schema.oneOf) {
        const validTypes = schema.oneOf.map(s => s.type);
        if (!validTypes.includes(actualType)) {
          errors.push({
            path: '',
            message: `Expected one of [${validTypes.join(', ')}] but got ${actualType}`,
            expected: validTypes,
            actual: actualType
          });
        }
      } else {
        errors.push({
          path: '',
          message: `Expected ${schema.type} but got ${actualType}`,
          expected: schema.type,
          actual: actualType
        });
      }
    }
  }
  
  // Validate object properties
  if (schema.type === 'object' && typeof data === 'object' && data !== null) {
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in data)) {
          errors.push({
            path: requiredField,
            message: `Required field '${requiredField}' is missing`,
            expected: 'present',
            actual: 'missing'
          });
        }
      }
    }
    
    // Validate properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(data)) {
        if (schema.properties[key]) {
          const propertyResult = validateAgainstSchema(value, schema.properties[key]);
          
          // Add path prefix to errors
          for (const error of propertyResult.errors) {
            errors.push({
              ...error,
              path: error.path ? `${key}.${error.path}` : key
            });
          }
        } else if (schema.additionalProperties === false) {
          errors.push({
            path: key,
            message: `Unexpected property '${key}' (additionalProperties is false)`,
            expected: 'not present',
            actual: 'present'
          });
        }
      }
    }
  }
  
  // Validate array items
  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        const itemResult = validateAgainstSchema(data[i], schema.items);
        
        // Add array index to path
        for (const error of itemResult.errors) {
          errors.push({
            ...error,
            path: error.path ? `[${i}].${error.path}` : `[${i}]`
          });
        }
      }
    }
    
    // Validate array constraints
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        path: '',
        message: `Array has ${data.length} items but minimum is ${schema.minItems}`,
        expected: `>= ${schema.minItems}`,
        actual: data.length
      });
    }
    
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        path: '',
        message: `Array has ${data.length} items but maximum is ${schema.maxItems}`,
        expected: `<= ${schema.maxItems}`,
        actual: data.length
      });
    }
  }
  
  // Validate string constraints
  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path: '',
        message: `String length ${data.length} is less than minimum ${schema.minLength}`,
        expected: `>= ${schema.minLength}`,
        actual: data.length
      });
    }
    
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path: '',
        message: `String length ${data.length} is greater than maximum ${schema.maxLength}`,
        expected: `<= ${schema.maxLength}`,
        actual: data.length
      });
    }
    
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          path: '',
          message: `String does not match pattern ${schema.pattern}`,
          expected: schema.pattern,
          actual: data
        });
      }
    }
    
    if (schema.format) {
      const formatResult = validateFormat(data, schema.format);
      if (!formatResult.valid) {
        errors.push({
          path: '',
          message: formatResult.message,
          expected: schema.format,
          actual: data
        });
      }
    }
  }
  
  // Validate number constraints
  if (schema.type === 'number' && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path: '',
        message: `Number ${data} is less than minimum ${schema.minimum}`,
        expected: `>= ${schema.minimum}`,
        actual: data
      });
    }
    
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path: '',
        message: `Number ${data} is greater than maximum ${schema.maximum}`,
        expected: `<= ${schema.maximum}`,
        actual: data
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get JSON Schema type for a value
 * @private
 */
function getJsonSchemaType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  
  const type = typeof value;
  
  if (type === 'object') {
    return 'object';
  }
  
  return type;
}

/**
 * Validate string format
 * @private
 */
function validateFormat(value, format) {
  switch (format) {
    case 'date-time':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          valid: false,
          message: `Invalid date-time format: ${value}`
        };
      }
      return { valid: true };
    
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          valid: false,
          message: `Invalid email format: ${value}`
        };
      }
      return { valid: true };
    
    case 'uri':
      try {
        new URL(value);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          message: `Invalid URI format: ${value}`
        };
      }
    
    case 'objectid':
      // MongoDB ObjectId is 24 character hex string
      const objectIdRegex = /^[0-9a-fA-F]{24}$/;
      if (!objectIdRegex.test(value)) {
        return {
          valid: false,
          message: `Invalid ObjectId format: ${value}`
        };
      }
      return { valid: true };
    
    default:
      // Unknown format - pass validation
      return { valid: true };
  }
}

/**
 * Merge multiple schemas into one
 * Used when documents have varying structures
 * @param {Array<Object>} schemas - Array of schemas to merge
 * @returns {Object} Merged schema
 */
export function mergeSchemas(schemas) {
  if (!schemas || schemas.length === 0) {
    return { type: 'object', properties: {} };
  }
  
  if (schemas.length === 1) {
    return schemas[0];
  }
  
  const merged = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: true
  };
  
  // Track which fields appear in all schemas (for required)
  const allFields = new Set();
  const fieldCounts = new Map();
  
  // Collect all properties
  for (const schema of schemas) {
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        allFields.add(field);
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
        
        if (!merged.properties[field]) {
          merged.properties[field] = fieldSchema;
        } else {
          // Merge field schemas
          merged.properties[field] = mergeFieldSchemas(
            merged.properties[field],
            fieldSchema
          );
        }
      }
    }
    
    // Track required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (fieldCounts.get(field) === schemas.length) {
          merged.required.push(field);
        }
      }
    }
  }
  
  return merged;
}

/**
 * Merge two field schemas
 * @private
 */
function mergeFieldSchemas(schema1, schema2) {
  // If types match, use the first schema
  if (schema1.type === schema2.type) {
    return schema1;
  }
  
  // If types differ, create oneOf
  return {
    oneOf: [
      { type: schema1.type },
      { type: schema2.type }
    ]
  };
}

/**
 * Check if data conforms to MongoDB document structure
 * @param {*} data - Data to check
 * @returns {Object} Result with valid flag and errors
 */
export function validateMongoDocument(data) {
  const errors = [];
  
  if (typeof data !== 'object' || data === null) {
    errors.push({
      path: '',
      message: 'MongoDB documents must be objects',
      expected: 'object',
      actual: typeof data
    });
    return { valid: false, errors };
  }
  
  // Check for invalid field names
  for (const key of Object.keys(data)) {
    // Field names cannot start with $ (reserved for operators)
    if (key.startsWith('$')) {
      errors.push({
        path: key,
        message: `Field name cannot start with '$': ${key}`,
        expected: 'field name not starting with $',
        actual: key
      });
    }
    
    // Field names cannot contain dots (used for nested access)
    if (key.includes('.')) {
      errors.push({
        path: key,
        message: `Field name cannot contain '.': ${key}`,
        expected: 'field name without dots',
        actual: key
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}