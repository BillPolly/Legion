/**
 * TaggedParser - Parse tagged content responses from LLM output
 * 
 * Handles simple tag-based formats like <FIELD>value</FIELD>
 */

import { SchemaExtensions } from '../SchemaExtensions.js';

export class TaggedParser {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = options;
    this.formatSpecs = SchemaExtensions.getFormatSpecs(schema, 'tagged');
  }

  parse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or invalid',
          field: null,
          suggestion: 'Ensure the response contains tagged content'
        }]
      };
    }

    try {
      const tags = this._extractTags(responseText);
      return {
        success: true,
        data: tags
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: error.message,
          field: null,
          suggestion: 'Check tag format: <TAG>content</TAG>'
        }]
      };
    }
  }

  _extractTags(text) {
    const result = {};
    const tagPattern = /<([A-Z_][A-Z0-9_]*)>([^<]*)<\/\1>/gi;
    let match;

    while ((match = tagPattern.exec(text)) !== null) {
      const tagName = match[1].toLowerCase();
      const tagContent = match[2].trim();
      
      // Handle repeated tags as arrays
      if (result.hasOwnProperty(tagName)) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]];
        }
        result[tagName].push(tagContent);
      } else {
        result[tagName] = tagContent;
      }
    }

    return result;
  }
}