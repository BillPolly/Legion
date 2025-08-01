/**
 * BaseFormatHandler - Abstract base class for format-specific handlers
 * 
 * All format handlers must implement:
 * - parse(content) - Convert format-specific content to HierarchyNode tree
 * - serialize(node) - Convert HierarchyNode tree back to format-specific content
 * - validate(content) - Validate format-specific content
 * - getEditableFields() - Define which fields are editable for this format
 */

import { HierarchyNode } from '../model/HierarchyNode.js';

export class BaseFormatHandler {
  constructor(config = {}) {
    this.config = config;
    this.format = this.constructor.format || 'unknown';
  }

  /**
   * Parse content into HierarchyNode tree
   * @param {string} content - Format-specific content
   * @returns {HierarchyNode} Root node of hierarchy
   */
  parse(content) {
    throw new Error('parse() method must be implemented by subclass');
  }

  /**
   * Serialize HierarchyNode tree back to format-specific content
   * @param {HierarchyNode} node - Root node to serialize
   * @returns {string} Format-specific content
   */
  serialize(node) {
    throw new Error('serialize() method must be implemented by subclass');
  }

  /**
   * Validate format-specific content
   * @param {string} content - Content to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate(content) {
    try {
      const node = this.parse(content);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error.message || 'Invalid content format'] 
      };
    }
  }

  /**
   * Get editable field configuration for this format
   * @returns {Object} Configuration for editable fields
   */
  getEditableFields() {
    return {
      keyEditable: true,      // Can edit object/element keys/names
      valueEditable: true,    // Can edit primitive values
      typeChangeable: false,  // Can change node types
      structureEditable: true // Can add/remove/move nodes
    };
  }

  /**
   * Get format-specific metadata for a node type
   * @param {string} nodeType - Type of node
   * @returns {Object} Metadata configuration
   */
  getNodeMetadata(nodeType) {
    return {};
  }

  /**
   * Create appropriate HierarchyNode for given data
   * @protected
   */
  _createNode(type, name, value = null, metadata = {}) {
    return new HierarchyNode({
      type,
      name,
      value,
      metadata: { ...metadata, format: this.format }
    });
  }

  /**
   * Helper to detect value type
   * @protected
   */
  _getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  /**
   * Helper to escape special characters for the format
   * @protected
   */
  _escape(str) {
    return str; // Override in subclasses as needed
  }

  /**
   * Helper to unescape special characters for the format
   * @protected
   */
  _unescape(str) {
    return str; // Override in subclasses as needed
  }

  /**
   * Get display name for this format
   */
  getDisplayName() {
    return this.format.toUpperCase();
  }

  /**
   * Get file extensions associated with this format
   */
  getFileExtensions() {
    return [];
  }

  /**
   * Get MIME types associated with this format
   */
  getMimeTypes() {
    return [];
  }

  /**
   * Check if content might be this format (heuristic)
   * @param {string} content - Content to check
   * @returns {boolean} True if content might be this format
   */
  mightBeFormat(content) {
    try {
      this.validate(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get default content for empty document
   */
  getDefaultContent() {
    const root = this._createNode('object', 'root');
    return this.serialize(root);
  }

  /**
   * Format content with proper indentation
   * @param {string} content - Content to format
   * @returns {string} Formatted content
   */
  format(content) {
    try {
      const node = this.parse(content);
      return this.serialize(node);
    } catch (error) {
      return content; // Return as-is if parse fails
    }
  }

  /**
   * Get icon or symbol for this format
   */
  getIcon() {
    return '📄';
  }

  /**
   * Get color theme for this format
   */
  getTheme() {
    return {
      primary: '#333',
      secondary: '#666',
      accent: '#0066cc'
    };
  }
}

// Static format registry
BaseFormatHandler.registry = new Map();

/**
 * Register a format handler
 * @static
 */
BaseFormatHandler.register = function(format, HandlerClass) {
  BaseFormatHandler.registry.set(format.toLowerCase(), HandlerClass);
};

/**
 * Get handler for format
 * @static
 */
BaseFormatHandler.getHandler = function(format) {
  const HandlerClass = BaseFormatHandler.registry.get(format.toLowerCase());
  if (!HandlerClass) {
    throw new Error(`No handler registered for format: ${format}`);
  }
  return new HandlerClass();
};

/**
 * Get all registered formats
 * @static
 */
BaseFormatHandler.getFormats = function() {
  return Array.from(BaseFormatHandler.registry.keys());
};