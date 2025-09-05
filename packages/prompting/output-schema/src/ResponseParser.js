/**
 * ResponseParser - Factory for format-specific parsers
 * 
 * Coordinates parsing across different formats and provides unified interface
 */

import { JSONParser } from './parsers/JSONParser.js';
import { XMLParser } from './parsers/XMLParser.js';
import { DelimitedParser } from './parsers/DelimitedParser.js';
import { TaggedParser } from './parsers/TaggedParser.js';
import { MarkdownParser } from './parsers/MarkdownParser.js';

export class ResponseParser {
  /**
   * Create a response parser factory
   * @param {Object} schema - Extended JSON Schema
   * @param {Object} options - Parser options
   */
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = options;
    
    // Create format-specific parsers
    this.parsers = {
      json: new JSONParser(schema, options.json || {}),
      xml: new XMLParser(schema, options.xml || {}),
      delimited: new DelimitedParser(schema, options.delimited || {}),
      tagged: new TaggedParser(schema, options.tagged || {}),
      markdown: new MarkdownParser(schema, options.markdown || {})
    };
  }

  /**
   * Parse response using specified format
   * @param {string} responseText - Response text to parse
   * @param {string} format - Format to use for parsing
   * @returns {Object} Parse result {success, data?, errors?}
   */
  parse(responseText, format) {
    if (!this.parsers[format]) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: `Unsupported format: ${format}`,
          field: null,
          suggestion: `Use one of: ${Object.keys(this.parsers).join(', ')}`
        }]
      };
    }

    return this.parsers[format].parse(responseText);
  }

  /**
   * Get available parsers
   * @returns {string[]} Array of supported format names
   */
  getSupportedFormats() {
    return Object.keys(this.parsers);
  }

  /**
   * Get parser for specific format
   * @param {string} format - Format name
   * @returns {Object} Parser instance
   */
  getParser(format) {
    return this.parsers[format];
  }
}