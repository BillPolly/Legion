/**
 * TreeScribe Parser Plugin Template
 * 
 * Use this template as a starting point for creating custom parser plugins.
 * Replace 'MyFormat' with your format name throughout this file.
 * 
 * @author Your Name
 * @version 1.0.0
 */

// Import BaseParser if available in your environment
// For browser plugins, BaseParser will be provided by TreeScribe
const BaseParser = globalThis.BaseParser || class BaseParser {
  // Stub for development
  _normalizeNode(node) { return node; }
};

/**
 * Parser implementation for MyFormat documents
 */
class MyFormatParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string} Parser name
   */
  getName() {
    return 'MyFormatParser';
  }

  /**
   * Get supported format identifiers
   * @returns {string[]} Array of format identifiers
   */
  getSupportedFormats() {
    // Return the file extensions or format names your parser supports
    return ['myformat', 'mfmt'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]} Array of MIME types
   */
  getSupportedMimeTypes() {
    // Return MIME types if your format has them
    return ['application/x-myformat', 'text/x-myformat'];
  }

  /**
   * Check if content can be parsed by this parser
   * @param {string} content - Document content
   * @param {Object} hints - Format hints (filename, mimeType, format)
   * @returns {number} Confidence score (0-1)
   */
  canParse(content, hints = {}) {
    // Priority 1: Check explicit format hint
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    // Priority 2: Check MIME type
    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Priority 3: Check content patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    let confidence = 0;

    // Add your format detection logic here
    // Example: Check for specific headers or patterns
    if (content.startsWith('MYFORMAT')) {
      confidence += 0.5;
    }

    // Check for other format indicators
    if (content.includes('specific-keyword')) {
      confidence += 0.3;
    }

    // Return confidence score (0-1)
    return Math.min(confidence, 0.95);
  }

  /**
   * Validate content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    const errors = [];

    // Check basic requirements
    if (!content || typeof content !== 'string') {
      errors.push('Content must be a non-empty string');
    }

    // Add format-specific validation
    if (content && !content.includes('required-element')) {
      errors.push('Missing required element');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse content into tree structure
   * @param {string} content - Document content
   * @param {Object} options - Parser options
   * @returns {Object} Normalized tree structure
   */
  parse(content, options = {}) {
    try {
      // Validate content
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Parse your format here
      const parsed = this._parseMyFormat(content, options);

      // Build tree structure
      const tree = this._buildTree(parsed, options);

      // Normalize and return
      const normalized = this._normalizeNode(tree);
      normalized.sourceFormat = 'myformat';

      return normalized;

    } catch (error) {
      // Return error node
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'myformat',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Parse format-specific content
   * @private
   * @param {string} content - Raw content
   * @param {Object} options - Parser options
   * @returns {Object} Parsed data
   */
  _parseMyFormat(content, options) {
    // Implement your parsing logic here
    // This is a simple example - replace with actual parsing

    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;

    for (const line of lines) {
      if (line.startsWith('SECTION:')) {
        // New section
        currentSection = {
          title: line.substring(8).trim(),
          content: [],
          subsections: []
        };
        sections.push(currentSection);
      } else if (currentSection && line.startsWith('  ')) {
        // Section content
        currentSection.content.push(line.trim());
      }
    }

    return {
      title: options.filename || 'MyFormat Document',
      sections
    };
  }

  /**
   * Build tree structure from parsed data
   * @private
   * @param {Object} parsed - Parsed data
   * @param {Object} options - Build options
   * @returns {Object} Tree structure
   */
  _buildTree(parsed, options) {
    const root = {
      title: parsed.title,
      content: `Document with ${parsed.sections.length} sections`,
      contentType: 'myformat',
      children: [],
      metadata: {
        parser: this.getName(),
        sectionCount: parsed.sections.length,
        parseOptions: options
      }
    };

    // Convert sections to tree nodes
    for (const section of parsed.sections) {
      const node = {
        title: section.title,
        content: section.content.join('\n'),
        contentType: 'text',
        children: []
      };

      // Add subsections if any
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          node.children.push({
            title: subsection.title,
            content: subsection.content,
            contentType: 'text'
          });
        }
      }

      root.children.push(node);
    }

    return root;
  }

  /**
   * Get parser capabilities
   * @returns {Object} Parser capabilities
   */
  getCapabilities() {
    return {
      // Basic capabilities (from BaseParser)
      async: false,
      streaming: false,
      bidirectional: false,
      preservesFormatting: true,
      requiresDOM: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB

      // Format-specific features
      features: [
        'sections',
        'nested-content',
        'metadata-extraction'
      ],

      // Parser-specific options
      options: {
        includeMeta: {
          type: 'boolean',
          default: true,
          description: 'Include metadata in parse result'
        },
        maxDepth: {
          type: 'number',
          default: 10,
          description: 'Maximum nesting depth'
        }
      }
    };
  }
}

/**
 * Plugin export
 * This is the main export that TreeScribe will load
 */
export default {
  // Required: Plugin metadata
  metadata: {
    name: 'MyFormatParser',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Parser for MyFormat documents',
    homepage: 'https://github.com/yourusername/myformat-parser',
    license: 'MIT'
  },

  // Required: Parser class
  Parser: MyFormatParser,

  // Optional: Configuration schema (JSON Schema)
  configSchema: {
    type: 'object',
    properties: {
      strictMode: {
        type: 'boolean',
        default: false,
        description: 'Enable strict parsing mode'
      },
      encoding: {
        type: 'string',
        default: 'utf-8',
        enum: ['utf-8', 'ascii', 'utf-16'],
        description: 'Document encoding'
      }
    }
  },

  // Optional: Example content for testing
  examples: {
    basic: `MYFORMAT 1.0
SECTION: Introduction
  This is the introduction content.
  It can span multiple lines.

SECTION: Main Content
  Here is the main content of the document.
  With more details.

SECTION: Conclusion
  The conclusion goes here.`,

    advanced: `MYFORMAT 2.0
METADATA
  author: John Doe
  date: 2024-01-17
END

SECTION: Chapter 1
  Content for chapter 1.
  SUBSECTION: 1.1
    Subsection content.
  END
END`
  },

  // Optional: Test suite
  tests: {
    'should parse basic format': (parser) => {
      const result = parser.parse('MYFORMAT\nSECTION: Test\n  Content');
      return result.children.length === 1 && result.children[0].title === 'Test';
    },
    
    'should detect format': (parser) => {
      const confidence = parser.canParse('MYFORMAT 1.0\nSome content');
      return confidence > 0.5;
    }
  }
};

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports.default;
}