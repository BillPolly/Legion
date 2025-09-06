/**
 * JSONParser - Parse JSON responses from LLM output
 * 
 * Handles standard JSON, JSON5, and JSON extraction from markdown/mixed content
 */

import JSON5 from 'json5';

export class JSONParser {
  /**
   * Create a JSON parser
   * @param {Object} schema - JSON Schema for validation context
   * @param {Object} options - Parser options
   */
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      strict: true,
      useJSON5: false,
      allowComments: false,
      ...options
    };
  }

  /**
   * Parse JSON from response text
   * @param {string} responseText - Text containing JSON
   * @returns {Object} Parse result {success, data?, errors?}
   */
  parse(responseText) {
    // Input validation
    if (!responseText) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or null',
          field: null,
          suggestion: 'Ensure the response contains valid JSON content'
        }]
      };
    }

    if (typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input must be a string',
          field: null,
          suggestion: 'Convert input to string before parsing'
        }]
      };
    }

    // Try to extract JSON from the response
    const jsonContent = this.extractJSON(responseText);
    
    if (!jsonContent) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'No JSON content found in response',
          field: null,
          suggestion: 'Ensure the response contains valid JSON structure'
        }]
      };
    }

    // Parse the extracted JSON
    try {
      const data = this.options.useJSON5 ? JSON5.parse(jsonContent) : JSON.parse(jsonContent);
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        errors: [this._createParseError(error, jsonContent)]
      };
    }
  }

  /**
   * Extract JSON content from mixed text
   * @param {string} text - Text that may contain JSON
   * @returns {string|null} Extracted JSON string or null
   */
  extractJSON(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const trimmed = text.trim();
    
    // Try direct parsing first (optimistic case)
    if (this._looksLikeJSON(trimmed)) {
      return trimmed;
    }

    // Try extracting from markdown code blocks
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
    const codeBlockMatch = text.match(codeBlockRegex);
    if (codeBlockMatch) {
      const blockContent = codeBlockMatch[1].trim();
      if (this._looksLikeJSON(blockContent)) {
        return blockContent;
      }
    }

    // Try extracting JSON by finding braces/brackets  
    const extracted = this._extractJSONByBraces(text);
    if (extracted && this._looksLikeJSON(extracted)) {
      // Validate the extracted JSON to ensure it's complete
      if (this.validateJSON(extracted)) {
        return extracted;
      }
    }

    return null;
  }

  /**
   * Validate if a string is valid JSON
   * @param {string} jsonString - String to validate
   * @returns {boolean} True if valid JSON
   */
  validateJSON(jsonString) {
    try {
      if (this.options.useJSON5) {
        JSON5.parse(jsonString);
      } else {
        JSON.parse(jsonString);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if text looks like JSON structure
   * @private
   */
  _looksLikeJSON(text) {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  /**
   * Extract JSON by matching braces/brackets
   * @private
   */
  _extractJSONByBraces(text) {
    // Look for object start
    const objectStart = text.indexOf('{');
    const arrayStart = text.indexOf('[');
    
    let start = -1;
    let startChar = '';
    let endChar = '';
    
    if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
      start = objectStart;
      startChar = '{';
      endChar = '}';
    } else if (arrayStart !== -1) {
      start = arrayStart;
      startChar = '[';
      endChar = ']';
    }
    
    if (start === -1) {
      return null;
    }
    
    // Count nested braces/brackets
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === startChar) {
          depth++;
        } else if (char === endChar) {
          depth--;
          if (depth === 0) {
            return text.substring(start, i + 1);
          }
        }
      }
    }
    
    return null; // Unmatched braces
  }

  /**
   * Create detailed parse error from JSON parse exception
   * @private
   */
  _createParseError(error, jsonContent) {
    const errorMessage = error.message;
    let line = 1;
    let column = 1;
    let suggestion = 'Check JSON syntax and structure';
    
    // Extract position information if available
    const positionMatch = errorMessage.match(/position (\d+)/);
    if (positionMatch) {
      const position = parseInt(positionMatch[1]);
      const lines = jsonContent.substring(0, position).split('\n');
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }
    
    // Provide specific suggestions based on error type
    if (errorMessage.includes('Unexpected token')) {
      if (errorMessage.includes(',')) {
        suggestion = 'Remove trailing comma or add missing property after comma';
      } else if (errorMessage.includes('}')) {
        suggestion = 'Check for missing comma before closing brace or extra closing brace';
      } else if (errorMessage.includes('"')) {
        suggestion = 'Check for unescaped quotes or missing closing quote';
      }
    } else if (errorMessage.includes('Unexpected end')) {
      suggestion = 'JSON appears incomplete - check for missing closing braces or brackets';
    } else if (errorMessage.includes('Expected')) {
      if (errorMessage.includes('comma') || errorMessage.includes(',')) {
        suggestion = 'Remove trailing comma or check for missing property after comma';
      } else {
        suggestion = 'Check for missing or misplaced commas, braces, or brackets';
      }
    }
    
    return {
      type: 'parsing',
      message: `Invalid JSON: ${errorMessage}`,
      field: null,
      location: { line, column },
      suggestion: suggestion
    };
  }
}