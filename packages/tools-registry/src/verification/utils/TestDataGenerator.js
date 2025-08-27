/**
 * TestDataGenerator - Generates test data from JSON Schema
 * 
 * Creates valid, invalid, and edge case test data based on schema definitions
 */

/**
 * Generate test data based on JSON Schema
 * @param {Object} schema - JSON Schema
 * @returns {Object} Object with valid, invalid, edge arrays
 */
export function generateTestDataFromSchema(schema) {
  return {
    valid: generateValidData(schema),
    invalid: generateInvalidData(schema),
    edge: generateEdgeCaseData(schema)
  };
}

/**
 * Generate valid test data
 * @private
 */
function generateValidData(schema) {
  const testData = [];
  
  if (!schema) {
    return [{}];
  }
  
  // Handle const first
  if (schema.const !== undefined) {
    testData.push(schema.const);
    return testData;
  }
  
  // Handle enum first  
  if (schema.enum && schema.enum.length > 0) {
    testData.push(...schema.enum);
    return testData;
  }
  
  // Handle anyOf/oneOf schemas without explicit type
  if (schema.anyOf && schema.anyOf.length > 0) {
    // Generate values for all schemas in anyOf
    for (const subSchema of schema.anyOf) {
      testData.push(generateValidValue(subSchema));
    }
    return testData;
  }
  
  if (schema.oneOf && schema.oneOf.length > 0) {
    // Generate values that match exactly one schema
    for (const subSchema of schema.oneOf) {
      testData.push(generateValidValue(subSchema));
    }
    return testData;
  }
  
  if (!schema.type) {
    return [{}];
  }
  
  switch (schema.type) {
    case 'object':
      // Generate basic valid object
      testData.push(generateValidObject(schema));
      
      // Generate with only required fields
      if (schema.required && schema.required.length > 0) {
        testData.push(generateMinimalObject(schema));
      }
      
      // Generate with all fields
      testData.push(generateCompleteObject(schema));
      break;
      
    case 'array':
      testData.push(generateValidArray(schema));
      break;
      
    case 'string':
      testData.push(generateValidString(schema));
      break;
      
    case 'number':
    case 'integer':
      testData.push(generateValidNumber(schema));
      break;
      
    case 'boolean':
      testData.push(true);
      testData.push(false);
      break;
      
    default:
      testData.push(null);
  }
  
  return testData;
}

/**
 * Generate invalid test data
 * @private
 */
function generateInvalidData(schema) {
  const testData = [];
  
  if (!schema || !schema.type) {
    return [null, undefined, 123, 'invalid'];
  }
  
  switch (schema.type) {
    case 'object':
      // Missing required fields
      if (schema.required && schema.required.length > 0) {
        for (const field of schema.required) {
          testData.push(generateObjectMissingField(schema, field));
        }
      }
      
      // Wrong types for fields
      if (schema.properties) {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
          testData.push(generateObjectWrongType(schema, field, fieldSchema));
        }
      }
      
      // Additional properties when not allowed
      if (schema.additionalProperties === false) {
        testData.push(generateObjectExtraFields(schema));
      }
      break;
      
    case 'array':
      // Wrong type
      testData.push('not an array');
      testData.push(123);
      testData.push({});
      
      // Violate minItems
      if (schema.minItems) {
        testData.push(new Array(schema.minItems - 1).fill(null));
      }
      
      // Violate maxItems
      if (schema.maxItems) {
        testData.push(new Array(schema.maxItems + 1).fill(null));
      }
      break;
      
    case 'string':
      // Wrong type
      testData.push(123);
      testData.push(true);
      testData.push([]);
      testData.push({});
      testData.push(null);
      
      // Violate minLength
      if (schema.minLength) {
        testData.push('x'.repeat(schema.minLength - 1));
      }
      
      // Violate maxLength
      if (schema.maxLength) {
        testData.push('x'.repeat(schema.maxLength + 1));
      }
      
      // Violate pattern
      if (schema.pattern) {
        testData.push('invalid_pattern_12345');
      }
      
      // For enum constraints, add invalid values
      if (schema.enum) {
        testData.push('yellow'); // not in the enum
        testData.push('not-in-enum');
      }
      
      // For const constraints, add invalid values
      if (schema.const !== undefined) {
        testData.push('other-value');
        testData.push('not-the-const');
      }
      break;
      
    case 'number':
    case 'integer':
      // Wrong type
      testData.push('not a number');
      testData.push(true);
      testData.push([]);
      testData.push({});
      
      // Violate minimum
      if (schema.minimum !== undefined) {
        testData.push(schema.minimum - 1);
      }
      
      // Violate maximum
      if (schema.maximum !== undefined) {
        testData.push(schema.maximum + 1);
      }
      
      // Wrong number type for integer
      if (schema.type === 'integer') {
        testData.push(3.14);
        testData.push(1.5);
      }
      break;
      
    case 'boolean':
      // Wrong type
      testData.push('true');
      testData.push(1);
      testData.push(0);
      testData.push([]);
      testData.push({});
      break;
      
    case 'null':
      // Wrong type
      testData.push('not-null');
      testData.push(1);
      testData.push(0);
      testData.push([]);
      testData.push({});
      testData.push(undefined);
      break;
  }
  
  return testData;
}

/**
 * Generate edge case test data
 * @private
 */
function generateEdgeCaseData(schema) {
  const testData = [];
  
  if (!schema || !schema.type) {
    return [null, undefined, {}, []];
  }
  
  switch (schema.type) {
    case 'object':
      // Empty object
      if (!schema.required || schema.required.length === 0) {
        testData.push({});
      }
      
      // Nested nulls and undefineds
      const edgeObject = {};
      if (schema.properties) {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
          if (!schema.required || !schema.required.includes(field)) {
            edgeObject[field] = null;
          } else {
            edgeObject[field] = generateEdgeValue(fieldSchema);
          }
        }
      }
      testData.push(edgeObject);
      break;
      
    case 'array':
      // Empty array
      testData.push([]);
      
      // Minimum items exactly
      if (schema.minItems) {
        testData.push(new Array(schema.minItems).fill(null));
      }
      
      // Maximum items exactly
      if (schema.maxItems) {
        testData.push(new Array(schema.maxItems).fill(null));
      }
      
      // Mixed types if allowed
      if (schema.items && !schema.items.type) {
        testData.push([1, 'two', true, null, {}]);
      }
      break;
      
    case 'string':
      // Empty string (always as edge case)
      testData.push('');
      
      // Minimum length exactly
      if (schema.minLength) {
        testData.push('x'.repeat(schema.minLength));
      }
      
      // Maximum length exactly
      if (schema.maxLength) {
        testData.push('x'.repeat(schema.maxLength));
      }
      
      // Special characters
      testData.push('test\nwith\nnewlines');
      testData.push('test\twith\ttabs');
      testData.push('test with spaces');
      testData.push('special!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~');
      
      // Unicode
      testData.push('emoji 😀 test');
      testData.push('unicode ñ é ü test');
      break;
      
    case 'number':
    case 'integer':
      // Zero
      testData.push(0);
      
      // Negative zero
      testData.push(-0);
      
      // Minimum exactly
      if (schema.minimum !== undefined) {
        testData.push(schema.minimum);
      }
      
      // Maximum exactly
      if (schema.maximum !== undefined) {
        testData.push(schema.maximum);
      }
      
      // Large numbers
      testData.push(Number.MAX_SAFE_INTEGER);
      testData.push(Number.MIN_SAFE_INTEGER);
      
      // Small decimals for number type
      if (schema.type === 'number') {
        testData.push(0.00000001);
        testData.push(-0.00000001);
      }
      break;
      
    case 'boolean':
      // Just true and false (already covered in valid)
      testData.push(true);
      testData.push(false);
      break;
  }
  
  return testData;
}

/**
 * Generate a valid object based on schema
 * @private
 */
function generateValidObject(schema) {
  const obj = {};
  
  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      // Include required fields and some optional fields
      if (schema.required && schema.required.includes(field)) {
        obj[field] = generateValidValue(fieldSchema);
      } else if (Math.random() > 0.5) {
        obj[field] = generateValidValue(fieldSchema);
      }
    }
  }
  
  return obj;
}

/**
 * Generate minimal valid object (only required fields)
 * @private
 */
function generateMinimalObject(schema) {
  const obj = {};
  
  if (schema.required && schema.properties) {
    for (const field of schema.required) {
      if (schema.properties[field]) {
        obj[field] = generateValidValue(schema.properties[field]);
      }
    }
  }
  
  return obj;
}

/**
 * Generate complete valid object (all fields)
 * @private
 */
function generateCompleteObject(schema) {
  const obj = {};
  
  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      obj[field] = generateValidValue(fieldSchema);
    }
  }
  
  return obj;
}

/**
 * Generate object missing a required field
 * @private
 */
function generateObjectMissingField(schema, missingField) {
  const obj = {};
  
  if (schema.required && schema.properties) {
    for (const field of schema.required) {
      if (field !== missingField && schema.properties[field]) {
        obj[field] = generateValidValue(schema.properties[field]);
      }
    }
  }
  
  return obj;
}

/**
 * Generate object with wrong type for a field
 * @private
 */
function generateObjectWrongType(schema, targetField, targetSchema) {
  const obj = {};
  
  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (field === targetField) {
        obj[field] = generateWrongTypeValue(targetSchema);
      } else if (schema.required && schema.required.includes(field)) {
        obj[field] = generateValidValue(fieldSchema);
      }
    }
  }
  
  return obj;
}

/**
 * Generate object with extra fields
 * @private
 */
function generateObjectExtraFields(schema) {
  const obj = generateValidObject(schema);
  obj.extraField1 = 'should not be here';
  obj.extraField2 = 123;
  return obj;
}

/**
 * Generate a valid array based on schema
 * @private
 */
function generateValidArray(schema) {
  const length = schema.minItems || 3;
  const arr = [];
  
  for (let i = 0; i < length; i++) {
    if (schema.items) {
      if (schema.uniqueItems) {
        // Generate unique values
        arr.push(generateValidValue(schema.items) + '_' + i);
      } else {
        arr.push(generateValidValue(schema.items));
      }
    } else {
      arr.push(i);
    }
  }
  
  return arr;
}

/**
 * Generate a valid string based on schema
 * @private
 */
function generateValidString(schema) {
  // Use default if provided
  if (schema.default) return schema.default;
  
  // Use enum if provided
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  
  // Generate based on format
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        return 'test@example.com';
      case 'uri':
      case 'url':
        return 'https://example.com';
      case 'date':
        return '2024-01-01';
      case 'date-time':
        return new Date().toISOString();
      case 'time':
        return '12:00:00';
      case 'uuid':
        return '123e4567-e89b-12d3-a456-426614174000';
      case 'ipv4':
        return '192.168.1.1';
      case 'ipv6':
        return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      default:
        // Fall through to pattern/length generation
    }
  }
  
  // Generate based on pattern
  if (schema.pattern) {
    // Simple pattern matching - just return a valid example
    if (schema.pattern === '^[A-Z][a-z]+$') {
      return 'Test';
    }
    if (schema.pattern.includes('[A-Z]')) {
      return 'ABC123';
    }
    if (schema.pattern.includes('[0-9]')) {
      return '12345';
    }
    if (schema.pattern.includes('^[a-z]')) {
      return 'lowercase-string';
    }
  }
  
  // Generate based on length constraints
  const minLen = schema.minLength || 1;
  const maxLen = schema.maxLength || 20;
  const targetLen = Math.min(minLen + 5, maxLen);
  
  return 'test_' + 'x'.repeat(Math.max(0, targetLen - 5));
}

/**
 * Generate a valid number based on schema
 * @private
 */
function generateValidNumber(schema) {
  // Use default if provided
  if (schema.default !== undefined) return schema.default;
  
  // Use enum if provided
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  
  let min, max;
  
  // Handle exclusive bounds
  if (schema.exclusiveMinimum !== undefined) {
    min = schema.exclusiveMinimum + (schema.type === 'integer' ? 1 : 0.1);
  } else {
    min = schema.minimum !== undefined ? schema.minimum : 0;
  }
  
  if (schema.exclusiveMaximum !== undefined) {
    max = schema.exclusiveMaximum - (schema.type === 'integer' ? 1 : 0.1);
  } else {
    max = schema.maximum !== undefined ? schema.maximum : 100;
  }
  
  if (schema.type === 'integer') {
    return Math.floor((min + max) / 2);
  }
  
  // For multipleOf constraint
  if (schema.multipleOf) {
    const multiple = Math.floor(((min + max) / 2) / schema.multipleOf);
    return multiple * schema.multipleOf;
  }
  
  return (min + max) / 2;
}

/**
 * Generate a valid value for any schema
 * @private
 */
function generateValidValue(schema) {
  if (!schema) return null;
  
  // Handle const
  if (schema.const !== undefined) {
    return schema.const;
  }
  
  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  
  // Handle default
  if (schema.default !== undefined) {
    return schema.default;
  }
  
  // Handle by type
  switch (schema.type) {
    case 'string':
      return generateValidString(schema);
    case 'number':
    case 'integer':
      return generateValidNumber(schema);
    case 'boolean':
      return true;
    case 'array':
      return generateValidArray(schema);
    case 'object':
      return generateValidObject(schema);
    case 'null':
      return null;
    default:
      // Handle multiple types
      if (Array.isArray(schema.type)) {
        // Pick first type
        return generateValidValue({ ...schema, type: schema.type[0] });
      }
      // Handle anyOf, oneOf
      if (schema.anyOf && schema.anyOf.length > 0) {
        return generateValidValue(schema.anyOf[0]);
      }
      if (schema.oneOf && schema.oneOf.length > 0) {
        return generateValidValue(schema.oneOf[0]);
      }
      return null;
  }
}

/**
 * Generate wrong type value for testing
 * @private
 */
function generateWrongTypeValue(schema) {
  if (!schema || !schema.type) return 'wrong';
  
  switch (schema.type) {
    case 'string':
      return 123; // number instead of string
    case 'number':
    case 'integer':
      return 'not a number'; // string instead of number
    case 'boolean':
      return 'true'; // string instead of boolean
    case 'array':
      return 'not an array'; // string instead of array
    case 'object':
      return 'not an object'; // string instead of object
    case 'null':
      return 'not null'; // string instead of null
    default:
      return undefined;
  }
}

/**
 * Generate edge case value
 * @private
 */
function generateEdgeValue(schema) {
  if (!schema) return null;
  
  switch (schema.type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    case 'null':
      return null;
    default:
      return null;
  }
}

/**
 * Generate test data for search keywords
 * @param {Array} keywords - Array of keywords for testing
 * @returns {Object} Test data with exact, partial, fuzzy, negative arrays
 */
export function generateKeywordTestData(keywords) {
  const testData = {
    exact: [],
    partial: [],
    fuzzy: [],
    negative: []
  };
  
  for (const keyword of keywords) {
    // Exact matches
    testData.exact.push(keyword);
    testData.exact.push(keyword.toLowerCase());
    testData.exact.push(keyword.toUpperCase());
    testData.exact.push(`test ${keyword}`);
    testData.exact.push(`${keyword} tool`);
    
    // Partial matches
    if (keyword.length > 3) {
      testData.partial.push(keyword.substring(0, Math.floor(keyword.length / 2)));
      testData.partial.push(keyword.substring(Math.floor(keyword.length / 2)));
      testData.partial.push(keyword.substring(1));
      testData.partial.push(keyword.slice(0, -1));
    }
    
    // Fuzzy matches (common typos)
    testData.fuzzy.push(keyword.replace(/er$/, 'ar')); // searcher -> searchar
    testData.fuzzy.push(keyword.replace(/or$/, 'er')); // calculator -> calculater
    testData.fuzzy.push(swapChars(keyword, 1, 2)); // swap adjacent chars
    testData.fuzzy.push(keyword.replace(/a/g, 'e')); // replace a with e
    testData.fuzzy.push(keyword.replace(/e/g, 'a')); // replace e with a
    
    // Negative test cases (should NOT match)
    testData.negative.push('completely-unrelated-term');
    testData.negative.push('random-string-' + Math.random().toString(36).substring(7));
    testData.negative.push(reverseString(keyword) + '-reversed');
  }
  
  // Add some general negative cases
  testData.negative.push('xyzzy-nonexistent');
  testData.negative.push('deliberately-wrong');
  testData.negative.push('not-found-anywhere');
  
  return testData;
}

/**
 * Helper function to swap characters in a string
 * @private
 */
function swapChars(str, i, j) {
  if (str.length <= Math.max(i, j)) return str;
  const arr = str.split('');
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return arr.join('');
}

/**
 * Helper function to reverse a string
 * @private
 */
function reverseString(str) {
  return str.split('').reverse().join('');
}

/**
 * Generate test data for specific JSON Schema keywords
 * @param {Object} schema - Schema with specific keywords
 * @returns {Object} Test data for each keyword
 */
export function generateSchemaKeywordTestData(schema) {
  const testData = {
    allOf: [],
    anyOf: [],
    oneOf: [],
    not: [],
    if: [],
    dependencies: [],
    patternProperties: []
  };
  
  // Generate for allOf
  if (schema.allOf) {
    // Should satisfy all schemas
    let combined = {};
    for (const subSchema of schema.allOf) {
      Object.assign(combined, generateValidValue(subSchema));
    }
    testData.allOf.push(combined);
  }
  
  // Generate for anyOf
  if (schema.anyOf) {
    // Should satisfy at least one schema
    for (const subSchema of schema.anyOf) {
      testData.anyOf.push(generateValidValue(subSchema));
    }
  }
  
  // Generate for oneOf
  if (schema.oneOf) {
    // Should satisfy exactly one schema
    for (const subSchema of schema.oneOf) {
      testData.oneOf.push(generateValidValue(subSchema));
    }
  }
  
  // Generate for not
  if (schema.not) {
    // Should NOT satisfy the schema
    testData.not.push(generateInvalidValue(schema.not));
  }
  
  return testData;
}

/**
 * Generate invalid value that doesn't match schema
 * @private
 */
function generateInvalidValue(schema) {
  // Generate value that violates the schema
  if (schema.type) {
    return generateWrongTypeValue(schema);
  }
  if (schema.enum) {
    return 'not-in-enum';
  }
  if (schema.const !== undefined) {
    return 'not-the-const-value';
  }
  return 'invalid';
}

export default generateTestDataFromSchema;