/**
 * YAMLParser - Parse YAML responses from LLM output
 * 
 * Handles basic YAML structure without external dependencies
 */

import { SchemaExtensions } from '../SchemaExtensions.js';

export class YAMLParser {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = options;
    this.formatSpecs = SchemaExtensions.getFormatSpecs(schema, 'yaml');
  }

  parse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or invalid',
          field: null,
          suggestion: 'Ensure the response contains YAML structure'
        }]
      };
    }

    try {
      const data = this._parseBasicYAML(responseText);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: error.message,
          field: null,
          suggestion: 'Check YAML syntax: key: value format'
        }]
      };
    }
  }

  /**
   * Basic YAML parsing (simple key-value and arrays)
   * @private
   */
  _parseBasicYAML(text) {
    const result = {};
    const lines = text.trim().split('\n');
    let currentKey = null;
    let currentArray = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue; // Skip empty lines and comments
      }

      // Array item
      if (trimmedLine.startsWith('- ')) {
        const item = trimmedLine.substring(2).trim();
        if (currentArray) {
          currentArray.push(this._parseValue(item));
        }
        continue;
      }

      // Key-value pair
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();
        
        if (value === '') {
          // Start of object or array
          currentKey = key;
          currentArray = [];
          result[key] = currentArray;
        } else {
          // Simple key-value
          result[key] = this._parseValue(value);
          currentArray = null;
        }
      }
    }

    return result;
  }

  /**
   * Parse YAML value (basic type inference)
   * @private
   */
  _parseValue(value) {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    
    // Number
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    // String (remove quotes if present)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    return value;
  }
}