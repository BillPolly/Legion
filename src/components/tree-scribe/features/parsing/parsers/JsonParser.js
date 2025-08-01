/**
 * JsonParser - JSON document parser for TreeScribe
 * Converts JSON structures into hierarchical trees
 */

import { BaseParser } from '../BaseParser.js';

export class JsonParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'JsonParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['json'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'application/json',
      'application/ld+json',
      'text/json'
    ];
  }

  /**
   * Check if content can be parsed as JSON
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {number} Confidence score (0-1)
   */
  canParse(content, hints = {}) {
    // Check hints first
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Check content for JSON patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    const trimmed = content.trim();
    
    // JSON must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return 0;
    }

    // Try basic JSON validation
    try {
      JSON.parse(content);
      return 0.95; // High confidence for valid JSON
    } catch {
      return 0.2; // Low confidence for invalid JSON that looks JSON-like
    }
  }

  /**
   * Validate JSON content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    if (content === null || content === undefined || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a string'] 
      };
    }

    if (content.trim() === '') {
      return { 
        valid: false, 
        errors: ['Content cannot be empty'] 
      };
    }

    try {
      JSON.parse(content);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [`Invalid JSON: ${error.message}`] 
      };
    }
  }

  /**
   * Parse JSON content into tree structure
   * @param {string} content - JSON content  
   * @param {Object} options - Parser options
   * @returns {Object} Normalized tree structure
   */
  parse(content, options = {}) {
    try {
      // Validate content first
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (jsonError) {
        throw new Error(`JSON parsing error: ${jsonError.message}`);
      }

      // Normalize the parsed structure
      const normalized = this._normalizeJsonStructure(parsed, options);
      
      // Ensure sourceFormat is set correctly
      normalized.sourceFormat = 'json';
      
      // Add parser metadata
      normalized.parseInfo = {
        ...normalized.parseInfo,
        originalFormat: 'json',
        parseTime: new Date().toISOString()
      };

      return normalized;

    } catch (error) {
      console.error('[JsonParser] Parse error:', error);
      // Return error document structure
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'json',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Normalize parsed JSON into tree structure
   * @private
   */
  _normalizeJsonStructure(obj, options = {}, path = '', depth = 0) {
    const maxDepth = options.maxDepth || 10;
    const arrayLimit = options.arrayLimit || 100;
    
    // Handle depth limit
    if (depth > maxDepth) {
      return this._normalizeNode({
        title: `[Max Depth Exceeded: ${maxDepth}]`,
        content: 'Structure too deep',
        contentType: 'plaintext',
        sourceFormat: 'json'
      });
    }

    // Handle null/undefined
    if (obj === null) {
      return this._normalizeNode({
        title: 'null',
        content: 'null',
        contentType: 'json',
        sourceFormat: 'json'
      });
    }

    if (obj === undefined) {
      return this._normalizeNode({
        title: 'undefined',
        content: 'undefined',
        contentType: 'json',
        sourceFormat: 'json'
      });
    }

    // Handle primitives
    if (typeof obj !== 'object') {
      const node = this._normalizeNode({
        title: String(obj),
        content: typeof obj === 'string' ? JSON.stringify(obj) : String(obj),
        contentType: 'json',
        sourceFormat: 'json'
      });
      return node;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      const title = path ? (obj.length === 0 ? path : `${path} (${obj.length} items)`) : (obj.length === 0 ? 'Empty Array' : `Array`);
      const limitedArray = obj.slice(0, arrayLimit);
      
      const children = limitedArray.map((item, index) => 
        this._normalizeJsonStructure(
          item, 
          options, 
          `[${index}]`, 
          depth + 1
        )
      );

      // Add truncation notice if array was limited
      if (obj.length > arrayLimit) {
        children.push(this._normalizeNode({
          title: `... and ${obj.length - arrayLimit} more items`,
          content: `Array truncated to first ${arrayLimit} items`,
          contentType: 'plaintext',
          sourceFormat: 'json'
        }));
      }

      return this._normalizeNode({
        title,
        content: obj.length === 0 ? 'Empty array []' : `Array with ${obj.length} items`,
        contentType: 'json',
        sourceFormat: 'json',
        children,
        metadata: {
          arrayLength: obj.length,
          truncated: obj.length > arrayLimit
        }
      });
    }

    // Handle objects
    const keys = Object.keys(obj);
    const title = this._generateObjectTitle(obj, path);
    const content = this._generateObjectContent(obj, keys);
    
    // Create children from object properties
    const children = keys.map(key => {
      const childPath = path ? `${path}.${key}` : key;
      const child = this._normalizeJsonStructure(
        obj[key], 
        options, 
        key, 
        depth + 1
      );
      
      // Use the key as the title if it's a simple value
      if (typeof obj[key] !== 'object' || obj[key] === null) {
        child.title = `${key}: ${child.title}`;
      } else {
        child.title = key;
      }
      
      return child;
    });

    return this._normalizeNode({
      title,
      content,
      contentType: 'json',
      sourceFormat: 'json',
      children,
      metadata: {
        objectKeys: keys,
        keyCount: keys.length,
        path: path || 'root'
      }
    });
  }

  /**
   * Generate meaningful title for JSON object
   * @private
   */
  _generateObjectTitle(obj, path) {
    // Look for common title/name fields
    const titleFields = ['title', 'name', 'label', 'id', 'key', 'type'];
    
    for (const field of titleFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        return obj[field];
      }
    }

    // Use path if available
    if (path) {
      return path;
    }

    // Count properties
    const keyCount = Object.keys(obj).length;
    return `Object (${keyCount} properties)`;
  }

  /**
   * Generate content description for JSON object
   * @private
   */
  _generateObjectContent(obj, keys) {
    if (keys.length === 0) {
      return 'Empty object {}';
    }

    // Show a few key-value pairs as preview
    const preview = keys.slice(0, 3).map(key => {
      const value = obj[key];
      let valueStr;
      
      if (value === null) {
        valueStr = 'null';
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          valueStr = `[Array: ${value.length} items]`;
        } else {
          valueStr = `{Object: ${Object.keys(value).length} props}`;
        }
      } else {
        valueStr = JSON.stringify(value);
        if (valueStr.length > 50) {
          valueStr = valueStr.substring(0, 47) + '...';
        }
      }
      
      return `${key}: ${valueStr}`;
    }).join('\n');

    if (keys.length > 3) {
      return `${preview}\n... and ${keys.length - 3} more properties`;
    }

    return preview;
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: false,
      bidirectional: true,  // Can recreate JSON from tree
      features: [
        'arrays',           // Array structure support
        'objects',          // Object hierarchy
        'primitives',       // All JSON primitive types
        'nested',           // Nested structures
        'large-files'       // Streaming for large JSON
      ]
    };
  }

  /**
   * Get parser metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.getName(),
      version: '1.0.0',
      author: 'TreeScribe Team',
      description: 'JSON document parser with object/array hierarchy support'
    };
  }

  /**
   * Get options schema
   * @returns {Object}
   */
  getOptionsSchema() {
    return {
      ...super.getOptionsSchema(),
      maxDepth: {
        type: 'number',
        default: 10,
        description: 'Maximum nesting depth to parse'
      },
      arrayLimit: {
        type: 'number',
        default: 100,
        description: 'Maximum number of array items to display'
      },
      showTypes: {
        type: 'boolean',
        default: true,
        description: 'Show data types in node titles'
      },
      compactArrays: {
        type: 'boolean',
        default: false,
        description: 'Compact display for primitive arrays'
      }
    };
  }
}