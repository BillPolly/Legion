/**
 * YamlProcessor - Handles YAML parsing and normalization
 */

import { parse as parseYaml } from '/lib/yaml';

export class YamlProcessor {
  /**
   * Parse YAML string and normalize to tree structure
   */
  static parse(yamlString) {
    try {
      if (!yamlString || yamlString.trim() === '') {
        return {
          title: 'Untitled',
          description: '',
          children: []
        };
      }

      const parsed = parseYaml(yamlString);
      if (!parsed) {
        return {
          title: 'Untitled',  
          description: '',
          children: []
        };
      }

      return this._normalizeStructure(parsed);
    } catch (error) {
      console.warn('YAML parsing error:', error);
      // Return minimal structure on error
      return {
        title: 'Untitled',
        description: error.message || 'YAML parsing failed',
        children: []
      };
    }
  }

  /**
   * Normalize parsed YAML into consistent tree structure
   * @private
   */
  static _normalizeStructure(obj, parentId = null) {
    const detectedType = obj.type || (obj.content && typeof obj.content === 'string' && obj.content.includes('#') ? 'markdown' : 'plaintext');
    console.log('[YamlProcessor] Processing node:', {
      title: obj.title,
      hasContent: !!obj.content,
      providedType: obj.type,
      detectedType: detectedType,
      contentPreview: obj.content ? obj.content.substring(0, 50) + '...' : 'no content'
    });
    
    const node = {
      id: obj.id || this._generateId(),
      title: obj.title || 'Untitled',
      content: obj.description || obj.content || '',
      contentType: detectedType,
      children: [],
      parentId,
      metadata: obj.metadata || {}
    };

    // Find all nested arrays and objects that represent children
    Object.keys(obj).forEach(key => {
      if (this._isChildCollection(key, obj[key])) {
        const children = this._processChildren(obj[key], node.id);
        node.children.push(...children);
      }
    });

    return node;
  }

  /**
   * Check if a key/value pair represents child nodes
   * @private
   */
  static _isChildCollection(key, value) {
    const childKeyPatterns = ['sections', 'subsections', 'children', 'items', 'parts'];
    
    if (childKeyPatterns.includes(key)) {
      return true;
    }
    
    // Check if it's an array of objects with titles
    return Array.isArray(value) && value.length > 0 && 
           value.every(item => item && typeof item === 'object' && 
           (item.title || item.name));
  }

  /**
   * Process children array into normalized node structures
   * @private
   */
  static _processChildren(children, parentId) {
    if (!Array.isArray(children)) {
      return [];
    }

    return children.map(child => {
      if (typeof child === 'string') {
        return {
          id: this._generateId(),
          title: child,
          content: '',
          contentType: 'plaintext',
          children: [],
          parentId,
          metadata: {}
        };
      } else if (typeof child === 'object') {
        return this._normalizeStructure(child, parentId);
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Generate unique ID
   * @private
   */
  static _generateId() {
    return 'yaml_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}

export class YamlParseError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = 'YamlParseError';
    this.line = line;
    this.column = column;
  }
}