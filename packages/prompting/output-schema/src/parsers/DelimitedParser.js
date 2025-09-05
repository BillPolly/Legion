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
    
    // More robust pattern that handles both with and without END markers
    const sectionPattern = /---([A-Z_][A-Z0-9_]*)---\s*([\s\S]*?)(?=---END-\1---|---[A-Z_][A-Z0-9_]*---|$)/gi;
    let match;

    while ((match = sectionPattern.exec(text)) !== null) {
      const sectionName = match[1].toLowerCase();
      let sectionContent = match[2].trim();
      
      // Remove explicit end marker if present
      const endMarker = new RegExp(`---END-${match[1]}---`, 'i');
      sectionContent = sectionContent.replace(endMarker, '').trim();
      
      // Parse array content if it looks like a list
      if (this._isListContent(sectionContent)) {
        result[sectionName] = this._parseListContent(sectionContent);
      } else {
        result[sectionName] = sectionContent;
      }
    }

    return result;
  }

  /**
   * Check if content looks like a list
   * @private
   */
  _isListContent(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return false;
    
    // Check for numbered lists
    const numberedPattern = /^\d+\.\s+/;
    const numberedCount = lines.filter(line => numberedPattern.test(line)).length;
    
    // Check for bullet lists
    const bulletPattern = /^[-*•]\s+/;
    const bulletCount = lines.filter(line => bulletPattern.test(line)).length;
    
    return numberedCount >= lines.length * 0.7 || bulletCount >= lines.length * 0.7;
  }

  /**
   * Parse list content into array
   * @private
   */
  _parseListContent(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    return lines.map(line => {
      // Remove list markers
      return line
        .replace(/^\d+\.\s+/, '')  // Remove "1. "
        .replace(/^[-*•]\s+/, '')  // Remove "- " or "* " or "• "
        .trim();
    });
  }
}