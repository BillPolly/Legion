/**
 * YamlParser - YAML document parser for TreeScribe
 * Refactored from YamlProcessor to use BaseParser interface
 */

import { BaseParser } from '../BaseParser.js';
import { parse as parseYaml } from '@lib/yaml';

export class YamlParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'YamlParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['yaml', 'yml'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'application/x-yaml',
      'application/yaml',
      'text/yaml',
      'text/x-yaml'
    ];
  }

  /**
   * Check if content can be parsed as YAML
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

    // Check content for YAML indicators
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // Common YAML patterns with weights
    const yamlPatterns = [
      { pattern: /^---\s*$/m, weight: 0.3 },           // Document separator
      { pattern: /^%YAML/, weight: 0.3 },              // YAML directive
      { pattern: /^\w+:\s*$/m, weight: 0.2 },         // Key with no value
      { pattern: /^\w+:\s+\S/m, weight: 0.2 },       // Key with value
      { pattern: /^\s*-\s+/m, weight: 0.15 },         // Array item
      { pattern: /^\w+:\s*\|/m, weight: 0.2 },       // Multiline string
      { pattern: /^\w+:\s*>/m, weight: 0.2 }          // Folded string
    ];

    let confidence = 0;
    let matchCount = 0;
    
    for (const { pattern, weight } of yamlPatterns) {
      if (pattern.test(content)) {
        confidence += weight;
        matchCount++;
      }
    }

    // Boost confidence if multiple patterns match
    if (matchCount >= 3) {
      confidence = Math.min(confidence * 1.2, 0.95);
    }

    // Cap confidence at 0.95 for content analysis
    return Math.min(confidence, 0.95);
  }

  /**
   * Validate YAML content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    // Allow empty content for YAML
    if (content === null || content === undefined || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a string'] 
      };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Parse YAML content into tree structure
   * @param {string} content - YAML content
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

      // Handle empty content
      if (!content || content.trim() === '') {
        return this._normalizeNode({
          title: 'Empty Document',
          content: '',
          children: [],
          sourceFormat: 'yaml'
        });
      }

      // Parse YAML
      let parsed;
      try {
        parsed = parseYaml(content);
      } catch (yamlError) {
        // Try to extract line/column info from YAML error
        const errorInfo = this._extractYamlErrorInfo(yamlError);
        throw new Error(`YAML parsing error at line ${errorInfo.line}: ${errorInfo.message}`);
      }

      // Handle null or undefined result
      if (parsed === null || parsed === undefined) {
        return this._normalizeNode({
          title: 'Empty Document',
          content: '',
          children: []
        });
      }

      // Normalize the parsed structure
      const normalized = this._normalizeStructure(parsed, options);
      
      // Add parser metadata
      normalized.parseInfo = {
        ...normalized.parseInfo,
        originalFormat: 'yaml',
        parseTime: new Date().toISOString()
      };
      
      // Ensure sourceFormat is set correctly
      normalized.sourceFormat = 'yaml';

      return normalized;

    } catch (error) {
      console.error('[YamlParser] Parse error:', error);
      // Return error document structure
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'yaml',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Normalize parsed YAML into tree structure
   * @private
   */
  _normalizeStructure(obj, options = {}, parentId = null) {
    // Handle primitive values
    if (obj === null || obj === undefined) {
      return this._normalizeNode({
        title: 'null',
        content: 'null',
        contentType: 'plaintext'
      });
    }

    if (typeof obj !== 'object') {
      return this._normalizeNode({
        title: String(obj),
        content: String(obj),
        contentType: 'plaintext'
      });
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return this._normalizeNode({
        title: 'Array',
        content: `Array with ${obj.length} items`,
        contentType: 'plaintext',
        children: obj.map((item, index) => 
          this._normalizeStructure(item, options, `${parentId}[${index}]`)
        )
      });
    }

    // Handle objects with TreeScribe structure
    if (obj.title || obj.content || obj.children) {
      const node = this._normalizeNode({
        title: obj.title || 'Untitled',
        content: obj.content || '',
        contentType: obj.contentType || obj.type || this._detectContentType(obj.content),
        metadata: obj.metadata || {},
        children: []
      });

      // Process children
      if (obj.children && Array.isArray(obj.children)) {
        node.children = obj.children.map(child => 
          this._normalizeStructure(child, options, node.id)
        );
      }

      // Add any extra properties as metadata
      Object.keys(obj).forEach(key => {
        if (!['title', 'content', 'children', 'contentType', 'type', 'metadata'].includes(key)) {
          node.metadata[key] = obj[key];
        }
      });

      return node;
    }

    // Handle generic objects
    const node = this._normalizeNode({
      title: obj.name || obj.id || 'Object',
      content: '',
      contentType: 'plaintext',
      children: [],
      metadata: {}
    });

    // Convert object properties to children
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const child = this._normalizeStructure(value, options, node.id);
        child.title = key;
        node.children.push(child);
      } else {
        // Store primitive values as metadata
        node.metadata[key] = value;
        if (!node.content) {
          node.content = `${key}: ${value}`;
        }
      }
    });

    return node;
  }

  /**
   * Extract error information from YAML parse error
   * @private
   */
  _extractYamlErrorInfo(error) {
    const info = {
      line: 0,
      column: 0,
      message: error.message || 'Unknown error'
    };

    // Try to extract line/column from error message
    const lineMatch = error.message.match(/line (\d+)/i);
    if (lineMatch) {
      info.line = parseInt(lineMatch[1]);
    }

    const columnMatch = error.message.match(/column (\d+)/i);
    if (columnMatch) {
      info.column = parseInt(columnMatch[1]);
    }

    return info;
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: true,
      bidirectional: true,  // Can recreate YAML from tree
      features: [
        'anchors',          // YAML anchors and references
        'multiDocument',    // Multiple documents in one file
        'customTags',       // Custom YAML tags
        'merge',            // Merge keys
        'comments'          // Preserve comments (future)
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
      version: '2.0.0',
      author: 'TreeScribe Team',
      description: 'YAML document parser with full YAML 1.2 support'
    };
  }

  /**
   * Get options schema
   * @returns {Object}
   */
  getOptionsSchema() {
    return {
      ...super.getOptionsSchema(),
      preserveComments: {
        type: 'boolean',
        default: false,
        description: 'Preserve YAML comments (experimental)'
      },
      resolveAnchors: {
        type: 'boolean',
        default: true,
        description: 'Resolve YAML anchors and aliases'
      },
      multiDocument: {
        type: 'boolean',
        default: false,
        description: 'Support multiple YAML documents in one file'
      },
      customTags: {
        type: 'object',
        default: {},
        description: 'Custom YAML tag handlers'
      }
    };
  }
}