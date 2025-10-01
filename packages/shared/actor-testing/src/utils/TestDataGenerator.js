/**
 * Test Data Generator
 *
 * Utilities for generating test data based on JSON schemas.
 * Useful for protocol testing and message validation.
 */

export class TestDataGenerator {
  /**
   * Generate valid test data from JSON schema
   */
  static generateValidData(schema, context = {}) {
    if (!schema || typeof schema !== 'object') {
      return {};
    }

    const data = {};

    for (const [key, spec] of Object.entries(schema)) {
      // Skip if not required and random skip
      if (!spec.required && Math.random() > 0.7) {
        continue;
      }

      data[key] = this.generateValueForType(spec, key, context);
    }

    return data;
  }

  /**
   * Generate invalid test data
   */
  static generateInvalidData(schema) {
    if (!schema || Object.keys(schema).length === 0) {
      return null; // Invalid for any schema that expects an object
    }

    const data = this.generateValidData(schema);

    // Make it invalid by violating constraints
    const keys = Object.keys(schema);
    if (keys.length > 0) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const spec = schema[randomKey];

      // Violate type constraint
      data[randomKey] = this.generateWrongType(spec.type);
    }

    return data;
  }

  /**
   * Generate value for a specific type
   */
  static generateValueForType(spec, key, context = {}) {
    switch (spec.type) {
      case 'string':
        return this.generateString(spec, key, context);

      case 'number':
      case 'integer':
        return this.generateNumber(spec, key, context);

      case 'boolean':
        return Math.random() > 0.5;

      case 'array':
        return this.generateArray(spec, key, context);

      case 'object':
        return this.generateObject(spec, key, context);

      case 'null':
        return null;

      default:
        return null;
    }
  }

  /**
   * Generate string value
   */
  static generateString(spec, key, context) {
    // Handle specific known keys
    if (key === 'goal') return context.goal || 'Test goal';
    if (key === 'message') return context.message || 'Test message';
    if (key === 'error') return 'Test error';
    if (key === 'timestamp') return new Date().toISOString();
    if (key === 'id') return `test-${Date.now()}`;
    if (key === 'name') return 'Test Name';
    if (key === 'email') return 'test@example.com';
    if (key === 'url') return 'http://test.example.com';

    // Handle constraints
    if (spec.enum) {
      return spec.enum[Math.floor(Math.random() * spec.enum.length)];
    }

    if (spec.pattern) {
      return this.generateFromPattern(spec.pattern);
    }

    if (spec.minLength) {
      return 'a'.repeat(spec.minLength);
    }

    if (spec.maxLength) {
      const length = Math.min(spec.maxLength, 20);
      return 'test-' + 'a'.repeat(length - 5);
    }

    return `test-${key}`;
  }

  /**
   * Generate number value
   */
  static generateNumber(spec, key, context) {
    const min = spec.minimum ?? spec.exclusiveMinimum ?? 0;
    const max = spec.maximum ?? spec.exclusiveMaximum ?? 100;

    let value;
    if (spec.type === 'integer') {
      value = Math.floor(Math.random() * (max - min)) + min;
    } else {
      value = Math.random() * (max - min) + min;
    }

    if (spec.multipleOf) {
      value = Math.round(value / spec.multipleOf) * spec.multipleOf;
    }

    return value;
  }

  /**
   * Generate array value
   */
  static generateArray(spec, key, context) {
    const minItems = spec.minItems ?? 1;
    const maxItems = spec.maxItems ?? 3;
    const length = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

    const items = [];
    for (let i = 0; i < length; i++) {
      if (spec.items) {
        items.push(this.generateValueForType(spec.items, key, context));
      } else {
        items.push(`item-${i}`);
      }
    }

    return items;
  }

  /**
   * Generate object value
   */
  static generateObject(spec, key, context) {
    if (key === 'result') {
      return { testResult: true, data: 'test-data' };
    }
    if (key === 'data') {
      return { testData: true };
    }

    if (spec.properties) {
      return this.generateValidData(spec.properties, context);
    }

    return { testKey: 'testValue' };
  }

  /**
   * Generate wrong type value (for invalid data)
   */
  static generateWrongType(expectedType) {
    const wrongTypes = {
      'string': 123,
      'number': 'not a number',
      'integer': 'not an integer',
      'boolean': 'not a boolean',
      'array': 'not an array',
      'object': 'not an object',
      'null': 'not null'
    };

    return wrongTypes[expectedType] ?? null;
  }

  /**
   * Generate string from regex pattern (simplified)
   */
  static generateFromPattern(pattern) {
    // Simple pattern handling - could be enhanced with proper regex generator
    if (pattern.includes('[a-z]')) return 'abc';
    if (pattern.includes('[A-Z]')) return 'ABC';
    if (pattern.includes('[0-9]')) return '123';
    return 'test';
  }

  /**
   * Generate mock actor
   */
  static createMockActor(overrides = {}) {
    return {
      receive: async (messageType, data) => ({ success: true }),
      send: async (messageType, data) => ({ success: true }),
      ...overrides
    };
  }

  /**
   * Generate mock WebSocket message
   */
  static createMockMessage(type, data = {}, meta = {}) {
    return JSON.stringify({
      type,
      data,
      timestamp: Date.now(),
      ...meta
    });
  }
}
