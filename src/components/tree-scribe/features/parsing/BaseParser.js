/**
 * BaseParser - Abstract base class for all document parsers
 * Follows umbilical protocol patterns for consistency
 */

export class BaseParser {
  /**
   * Get parser name/identifier
   * @returns {string} Parser name
   */
  getName() {
    throw new Error('BaseParser.getName() must be implemented by subclass');
  }

  /**
   * Get supported format identifiers
   * @returns {string[]} Array of format IDs (e.g., ['yaml', 'yml'])
   */
  getSupportedFormats() {
    throw new Error('BaseParser.getSupportedFormats() must be implemented by subclass');
  }

  /**
   * Get supported MIME types
   * @returns {string[]} Array of MIME types
   */
  getSupportedMimeTypes() {
    return [];
  }

  /**
   * Check if parser can handle given content
   * @param {string} content - Document content
   * @param {Object} hints - Format hints (extension, mimeType, filename, etc.)
   * @returns {number} Confidence score (0-1)
   */
  canParse(content, hints = {}) {
    throw new Error('BaseParser.canParse() must be implemented by subclass');
  }

  /**
   * Parse content into tree structure
   * @param {string} content - Document content
   * @param {Object} options - Parser options
   * @returns {Object} Normalized tree structure
   */
  parse(content, options = {}) {
    throw new Error('BaseParser.parse() must be implemented by subclass');
  }

  /**
   * Validate content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    // Default implementation - can be overridden
    try {
      if (!content || typeof content !== 'string') {
        return { 
          valid: false, 
          errors: ['Content must be a non-empty string'] 
        };
      }
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error.message] 
      };
    }
  }

  /**
   * Get parser capabilities (similar to umbilical describe pattern)
   * @returns {Object} Parser feature flags
   */
  getCapabilities() {
    return {
      supportsStreaming: false,
      supportsPartialParse: false,
      preservesFormatting: true,
      bidirectional: false,  // Can recreate original from tree
      maxFileSize: null,     // null = no limit
      requiresDOM: false,
      async: false
    };
  }

  /**
   * Get parser metadata
   * @returns {Object} Parser information
   */
  getMetadata() {
    return {
      name: this.getName(),
      version: '1.0.0',
      author: 'Unknown',
      description: 'Document parser'
    };
  }

  /**
   * Normalize parsed structure to TreeNode format
   * Helper method for consistent output
   * @protected
   */
  _normalizeNode(data) {
    return {
      id: data.id || this._generateId(),
      title: data.title || 'Untitled',
      content: data.content || '',
      contentType: data.contentType || 'plaintext',
      children: data.children || [],
      metadata: data.metadata || {},
      sourceFormat: data.sourceFormat || this.constructor.name.toLowerCase().replace('parser', ''),
      parseInfo: {
        parser: this.getName(),
        timestamp: new Date().toISOString(),
        ...data.parseInfo
      }
    };
  }

  /**
   * Generate unique ID for nodes
   * @protected
   */
  _generateId() {
    const name = this.constructor.name.toLowerCase().replace('parser', '') || 'parser';
    return `${name}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  /**
   * Detect content type from content string
   * @protected
   */
  _detectContentType(content) {
    if (!content || typeof content !== 'string') return 'plaintext';
    
    // Check for markdown indicators
    if (content.includes('```') || content.match(/^#+\s/m) || content.includes('**')) {
      return 'markdown';
    }
    
    // Check for HTML
    if (content.match(/<[^>]+>/)) {
      return 'html';
    }
    
    // Check for code-like content
    if (content.match(/^\s*(function|class|const|let|var|import|export)\s/m)) {
      return 'javascript';
    }
    
    return 'plaintext';
  }

  /**
   * Introspection support (umbilical pattern)
   * Describe parser requirements and capabilities
   */
  describe() {
    return {
      name: this.getName(),
      formats: this.getSupportedFormats(),
      mimeTypes: this.getSupportedMimeTypes(),
      capabilities: this.getCapabilities(),
      metadata: this.getMetadata(),
      options: this.getOptionsSchema()
    };
  }

  /**
   * Get schema for parser options
   * Override to provide specific options
   */
  getOptionsSchema() {
    return {
      maxDepth: {
        type: 'number',
        default: null,
        description: 'Maximum tree depth to parse'
      },
      includeMetadata: {
        type: 'boolean',
        default: true,
        description: 'Include metadata in parsed nodes'
      }
    };
  }
}