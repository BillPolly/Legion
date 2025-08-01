/**
 * ParserRegistry - Manages document parsers for TreeScribe
 * Similar to RendererRegistry pattern but for parsing documents
 */

import { BaseParser } from './BaseParser.js';

export class ParserRegistry {
  constructor() {
    this.parsers = new Map();
    this.formatMap = new Map();  // format string -> parser
    this.mimeMap = new Map();    // mime type -> parser
    this.defaultParser = null;
  }

  /**
   * Register a parser
   * @param {BaseParser} parser - Parser instance
   * @throws {Error} If parser is invalid
   */
  registerParser(parser) {
    if (!parser || !(parser instanceof BaseParser)) {
      throw new Error('Parser must be an instance of BaseParser');
    }

    const name = parser.getName();
    if (!name) {
      throw new Error('Parser must have a name');
    }

    // Store parser
    this.parsers.set(name, parser);
    
    // Map formats to parser
    const formats = parser.getSupportedFormats();
    if (!Array.isArray(formats) || formats.length === 0) {
      throw new Error('Parser must support at least one format');
    }
    
    formats.forEach(format => {
      this.formatMap.set(format.toLowerCase(), parser);
    });
    
    // Map MIME types to parser
    const mimeTypes = parser.getSupportedMimeTypes();
    if (Array.isArray(mimeTypes)) {
      mimeTypes.forEach(mime => {
        this.mimeMap.set(mime.toLowerCase(), parser);
      });
    }

    console.log(`[ParserRegistry] Registered parser: ${name} for formats: ${formats.join(', ')}`);
  }

  /**
   * Unregister a parser
   * @param {string} name - Parser name
   */
  unregisterParser(name) {
    const parser = this.parsers.get(name);
    if (!parser) return;

    // Remove from all maps
    this.parsers.delete(name);
    
    parser.getSupportedFormats().forEach(format => {
      this.formatMap.delete(format.toLowerCase());
    });
    
    parser.getSupportedMimeTypes().forEach(mime => {
      this.mimeMap.delete(mime.toLowerCase());
    });

    if (this.defaultParser === parser) {
      this.defaultParser = null;
    }
  }

  /**
   * Set default parser for unknown formats
   * @param {string} name - Parser name
   */
  setDefaultParser(name) {
    const parser = this.parsers.get(name);
    if (!parser) {
      throw new Error(`Parser not found: ${name}`);
    }
    this.defaultParser = parser;
  }

  /**
   * Get parser for content
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {BaseParser|null} Suitable parser or null
   */
  getParser(content, hints = {}) {
    // Try explicit format first
    if (hints.format) {
      const parser = this.formatMap.get(hints.format.toLowerCase());
      if (parser) {
        const confidence = parser.canParse(content, hints);
        if (confidence > 0) {
          console.log(`[ParserRegistry] Using parser ${parser.getName()} for format: ${hints.format}`);
          return parser;
        }
      }
    }
    
    // Try MIME type
    if (hints.mimeType) {
      const parser = this.mimeMap.get(hints.mimeType.toLowerCase());
      if (parser) {
        const confidence = parser.canParse(content, hints);
        if (confidence > 0) {
          console.log(`[ParserRegistry] Using parser ${parser.getName()} for MIME: ${hints.mimeType}`);
          return parser;
        }
      }
    }
    
    // Try file extension from filename
    if (hints.filename) {
      const ext = this._getFileExtension(hints.filename);
      if (ext) {
        const parser = this.formatMap.get(ext);
        if (parser) {
          const confidence = parser.canParse(content, hints);
          if (confidence > 0) {
            console.log(`[ParserRegistry] Using parser ${parser.getName()} for extension: ${ext}`);
            return parser;
          }
        }
      }
    }
    
    // Auto-detect by trying each parser and selecting highest confidence
    let bestParser = null;
    let bestConfidence = 0;
    
    for (const parser of this.parsers.values()) {
      const confidence = parser.canParse(content, hints);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestParser = parser;
      }
    }
    
    if (bestParser && bestConfidence > 0.5) {
      console.log(`[ParserRegistry] Auto-detected parser: ${bestParser.getName()} (confidence: ${bestConfidence})`);
      return bestParser;
    }
    
    // Use default parser if set
    if (this.defaultParser) {
      const confidence = this.defaultParser.canParse(content, hints);
      if (confidence > 0) {
        console.log(`[ParserRegistry] Using default parser: ${this.defaultParser.getName()}`);
        return this.defaultParser;
      }
    }
    
    console.warn('[ParserRegistry] No suitable parser found');
    return null;
  }

  /**
   * Get parser by name
   * @param {string} name - Parser name
   * @returns {BaseParser|null}
   */
  getParserByName(name) {
    return this.parsers.get(name) || null;
  }

  /**
   * Get parser by format
   * @param {string} format - Format identifier
   * @returns {BaseParser|null}
   */
  getParserByFormat(format) {
    return this.formatMap.get(format.toLowerCase()) || null;
  }

  /**
   * Get all registered formats
   * @returns {string[]} Format identifiers
   */
  getFormats() {
    return Array.from(this.formatMap.keys());
  }

  /**
   * Get all registered parsers
   * @returns {BaseParser[]} Parser instances
   */
  getParsers() {
    return Array.from(this.parsers.values());
  }

  /**
   * Get all registered parser names
   * @returns {string[]} Parser names
   */
  getParserNames() {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if format is supported
   * @param {string} format - Format identifier
   * @returns {boolean}
   */
  hasFormat(format) {
    return this.formatMap.has(format.toLowerCase());
  }

  /**
   * Get parser capabilities for all parsers
   * @returns {Object} Map of parser names to capabilities
   */
  getAllCapabilities() {
    const capabilities = {};
    for (const [name, parser] of this.parsers) {
      capabilities[name] = parser.describe();
    }
    return capabilities;
  }

  /**
   * Extract file extension from filename
   * @private
   */
  _getFileExtension(filename) {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Clear all registered parsers
   */
  clear() {
    this.parsers.clear();
    this.formatMap.clear();
    this.mimeMap.clear();
    this.defaultParser = null;
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry stats
   */
  getStats() {
    return {
      parserCount: this.parsers.size,
      formatCount: this.formatMap.size,
      mimeTypeCount: this.mimeMap.size,
      hasDefault: !!this.defaultParser,
      parsers: this.getParserNames(),
      formats: this.getFormats()
    };
  }
}