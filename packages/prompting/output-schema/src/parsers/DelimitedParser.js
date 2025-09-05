/**
 * DelimitedParser - Parse delimited section responses from LLM output
 * 
 * Handles section-based formats like ---FIELD--- or ===FIELD===
 */

import { SchemaExtensions } from '../SchemaExtensions.js';

export class DelimitedParser {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = options;
    this.formatSpecs = SchemaExtensions.getFormatSpecs(schema, 'delimited');
  }

  parse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or invalid',
          field: null,
          suggestion: 'Ensure the response contains delimited sections'
        }]
      };
    }

    try {
      const sections = this._extractSections(responseText);
      return {
        success: true,
        data: sections
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: error.message,
          field: null,
          suggestion: 'Check section delimiter format'
        }]
      };
    }
  }

  _extractSections(text) {
    const result = {};
    const sectionPattern = /---([A-Z_][A-Z0-9_]*)---\s*([\s\S]*?)(?=---[A-Z_]|$)/gi;
    let match;

    while ((match = sectionPattern.exec(text)) !== null) {
      const sectionName = match[1].toLowerCase();
      let sectionContent = match[2].trim();
      
      // Remove end marker if present
      sectionContent = sectionContent.replace(/---END-[A-Z_][A-Z0-9_]*---$/i, '').trim();
      
      result[sectionName] = sectionContent;
    }

    return result;
  }
}