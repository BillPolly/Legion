/**
 * FormatHandler - Abstract base class for format handlers
 */

export class FormatHandler {
  constructor(formatType, metadata = {}) {
    if (new.target === FormatHandler) {
      throw new Error('FormatHandler is abstract and cannot be instantiated directly');
    }

    this.formatType = formatType;
    this.metadata = {
      name: metadata.name || formatType,
      extensions: metadata.extensions || [],
      mimeTypes: metadata.mimeTypes || [],
      ...metadata
    };
  }

  /**
   * Get the format type identifier
   */
  getFormatType() {
    return this.formatType;
  }

  /**
   * Get the human-readable format name
   */
  getName() {
    return this.metadata.name;
  }

  /**
   * Get supported file extensions
   */
  getExtensions() {
    return this.metadata.extensions;
  }

  /**
   * Get supported MIME types
   */
  getMimeTypes() {
    return this.metadata.mimeTypes;
  }

  /**
   * Get handler capabilities
   */
  getCapabilities() {
    return {
      parse: this.canParse(),
      serialize: this.canSerialize(),
      validate: this.canValidate()
    };
  }

  /**
   * Check if handler can parse content
   */
  canParse() {
    return true;
  }

  /**
   * Check if handler can serialize content
   */
  canSerialize() {
    return true;
  }

  /**
   * Check if handler can validate content
   */
  canValidate() {
    return true;
  }

  /**
   * Parse content into HierarchyNode structure
   * @param {string} content - Raw content to parse
   * @returns {HierarchyNode} Root node of parsed hierarchy
   * @abstract
   */
  parse(content) {
    throw new Error('parse() method must be implemented by subclass');
  }

  /**
   * Serialize HierarchyNode structure to content
   * @param {HierarchyNode} node - Root node to serialize
   * @returns {string} Serialized content
   * @abstract
   */
  serialize(node) {
    throw new Error('serialize() method must be implemented by subclass');
  }

  /**
   * Validate content for this format
   * @param {string} content - Content to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   * @abstract
   */
  validate(content) {
    throw new Error('validate() method must be implemented by subclass');
  }
}