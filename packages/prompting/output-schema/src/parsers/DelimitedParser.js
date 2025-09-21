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
      const rawSectionName = match[1];
      let sectionContent = match[2].trim();
      
      // Remove explicit end marker if present
      const endMarker = new RegExp(`---END-${rawSectionName}---`, 'i');
      sectionContent = sectionContent.replace(endMarker, '').trim();
      
      // Map section name to schema property name
      const propertyName = this._mapSectionToProperty(rawSectionName);
      
      // Try to parse JSON content if it looks like JSON, otherwise return raw text
      result[propertyName] = this._parseContent(sectionContent);
    }

    return result;
  }

  /**
   * Map delimiter section name to schema property name
   * @private
   */
  _mapSectionToProperty(sectionName) {
    // Get schema properties
    const schemaProperties = this.schema.properties || {};
    const propertyNames = Object.keys(schemaProperties);
    
    // Try exact match first
    if (propertyNames.includes(sectionName)) {
      return sectionName;
    }
    
    // Try lowercase match
    const lowerSection = sectionName.toLowerCase();
    if (propertyNames.includes(lowerSection)) {
      return lowerSection;
    }
    
    // Try case-insensitive match
    const matchingProperty = propertyNames.find(prop => 
      prop.toLowerCase() === lowerSection
    );
    
    if (matchingProperty) {
      return matchingProperty;
    }
    
    // If no match found, return the original section name converted to lowercase
    // This maintains backwards compatibility
    return lowerSection;
  }

  /**
   * Parse content - if it looks like JSON, parse it; otherwise return as string
   * @private
   */
  _parseContent(content) {
    // Try to detect if content is JSON
    const trimmed = content.trim();
    
    // Check if it looks like JSON array or object
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // If JSON parsing fails, return as string
        return content;
      }
    }
    
    // Not JSON-like, return as string
    return content;
  }
}