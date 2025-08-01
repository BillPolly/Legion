/**
 * JsonHandler - JSON format parser and serializer
 */
import { BaseFormatHandler } from './BaseFormatHandler.js';
import { HierarchyNode } from '../model/HierarchyNode.js';

export class JsonHandler extends BaseFormatHandler {
  static format = 'json';

  constructor(config = {}) {
    super(config);
    this.indentSize = config.indentSize || 2;
  }

  /**
   * Parse JSON content into HierarchyNode structure
   */
  parse(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('JSON content must be a non-empty string');
    }

    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }

    const rootNode = this._parseValue(jsonData, null, 'root');
    rootNode.metadata = {
      format: 'json',
      originalContent: content,
      ...rootNode.metadata
    };

    return rootNode;
  }

  /**
   * Serialize HierarchyNode structure to JSON
   */
  serialize(node) {
    if (!node) {
      throw new Error('Node is required for serialization');
    }

    const jsonData = this._serializeNode(node);
    return JSON.stringify(jsonData, null, 2);
  }

  /**
   * Validate JSON content
   */
  validate(content) {
    if (!content || typeof content !== 'string') {
      return {
        valid: false,
        errors: ['Content must be a non-empty string']
      };
    }

    try {
      JSON.parse(content);
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${error.message}`]
      };
    }
  }

  /**
   * Detect if content is likely JSON
   */
  detect(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();
    
    // Must start and end with JSON delimiters
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
      return false;
    }

    // Try to parse it
    try {
      JSON.parse(trimmed);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get format metadata
   */
  getMetadata() {
    return {
      format: 'json',
      mimeType: 'application/json',
      fileExtensions: ['.json'],
      supportsComments: false,
      supportsTrailingCommas: false,
      requiresQuotedKeys: true
    };
  }

  /**
   * Parse a JSON value into HierarchyNode
   * @private
   */
  _parseValue(value, parent, name) {
    const nodeData = {
      name: name,
      parent: parent
    };

    if (value === null) {
      return new HierarchyNode({
        ...nodeData,
        type: 'value',
        value: null
      });
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Object
      const objectNode = new HierarchyNode({
        ...nodeData,
        type: 'object',
        value: null
      });

      const children = [];
      for (const [key, childValue] of Object.entries(value)) {
        const childNode = this._parseValue(childValue, objectNode, key);
        children.push(childNode);
      }
      objectNode.children = children;

      return objectNode;
    }

    if (Array.isArray(value)) {
      // Array
      const arrayNode = new HierarchyNode({
        ...nodeData,
        type: 'array',
        value: null
      });

      const children = [];
      value.forEach((item, index) => {
        const childNode = this._parseValue(item, arrayNode, index.toString());
        children.push(childNode);
      });
      arrayNode.children = children;

      return arrayNode;
    }

    // Primitive value
    return new HierarchyNode({
      ...nodeData,
      type: 'value',
      value: value
    });
  }

  /**
   * Serialize HierarchyNode to JSON data
   * @private
   */
  _serializeNode(node) {
    if (node.type === 'value') {
      return node.value;
    }

    if (node.type === 'object') {
      const obj = {};
      for (const child of node.children) {
        obj[child.name] = this._serializeNode(child);
      }
      return obj;
    }

    if (node.type === 'array') {
      const arr = [];
      // Sort children by numeric index for proper array order
      const sortedChildren = [...node.children].sort((a, b) => {
        const aIndex = parseInt(a.name, 10);
        const bIndex = parseInt(b.name, 10);
        return aIndex - bIndex;
      });

      for (const child of sortedChildren) {
        const index = parseInt(child.name, 10);
        arr[index] = this._serializeNode(child);
      }
      return arr;
    }

    throw new Error(`Unknown node type: ${node.type}`);
  }

  /**
   * Get editable fields configuration
   */
  getEditableFields() {
    return {
      keyEditable: true,      // Object keys can be edited
      valueEditable: true,    // Values can be edited
      typeChangeable: true,   // Can change value types (string to number, etc.)
      structureEditable: true // Can add/remove properties
    };
  }
}

// Register the handler
BaseFormatHandler.register('json', JsonHandler);