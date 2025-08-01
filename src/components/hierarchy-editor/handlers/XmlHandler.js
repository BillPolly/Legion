/**
 * XML Handler - Parse and serialize XML to/from HierarchyNode format
 */
import { BaseFormatHandler } from './BaseFormatHandler.js';
import { HierarchyNode } from '../model/HierarchyNode.js';

export class XmlHandler extends BaseFormatHandler {
  static format = 'xml';
  
  constructor(config = {}) {
    super(config);
    this.indentSize = config.indentSize || 2;
    this.indentChar = ' ';
  }

  /**
   * Parse XML string to HierarchyNode
   */
  parse(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') {
      throw new Error('Invalid XML input');
    }

    try {
      // Use DOMParser for XML parsing
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'application/xml');
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error(`XML parsing error: ${parserError.textContent}`);
      }

      // Find the root element
      const rootElement = doc.documentElement;
      if (!rootElement) {
        throw new Error('No root element found in XML');
      }

      return this.convertDomNodeToHierarchy(rootElement);
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  /**
   * Serialize HierarchyNode to XML string
   */
  serialize(node, options = {}) {
    const indent = options.indent || '';
    const compact = options.compact || false;
    
    // Track visited nodes to prevent circular references
    const visited = new WeakSet();
    
    return this.serializeNode(node, 0, indent, compact, visited);
  }

  /**
   * Convert DOM Node to HierarchyNode format
   * @private
   */
  convertDomNodeToHierarchy(domNode) {
    const nodeId = this.generateNodeId();
    
    switch (domNode.nodeType) {
      case Node.ELEMENT_NODE:
        return {
          id: nodeId,
          type: 'element',
          name: domNode.nodeName.toLowerCase(),
          value: null,
          attributes: this.extractAttributes(domNode),
          children: this.convertChildNodes(domNode),
          metadata: {
            originalName: domNode.nodeName,
            namespace: domNode.namespaceURI
          }
        };
        
      case Node.TEXT_NODE:
        const textValue = domNode.textContent;
        // Always include text nodes, but mark whitespace-only nodes
        return {
          id: nodeId,
          type: 'text',
          name: '#text',
          value: textValue,
          attributes: {},
          children: [],
          metadata: {
            isWhitespaceOnly: textValue.trim() === '',
            isSignificant: this.isSignificantWhitespace(domNode)
          }
        };
        
      case Node.CDATA_SECTION_NODE:
        return {
          id: nodeId,
          type: 'cdata',
          name: '#cdata-section',
          value: domNode.textContent,
          attributes: {},
          children: [],
          metadata: {}
        };
        
      case Node.COMMENT_NODE:
        return {
          id: nodeId,
          type: 'comment',
          name: '#comment',
          value: domNode.textContent,
          attributes: {},
          children: [],
          metadata: {}
        };
        
      case Node.PROCESSING_INSTRUCTION_NODE:
        return {
          id: nodeId,
          type: 'processingInstruction',
          name: domNode.target,
          value: domNode.data,
          attributes: {},
          children: [],
          metadata: {}
        };
        
      default:
        return null;
    }
  }

  /**
   * Convert child nodes to HierarchyNode array
   * @private
   */
  convertChildNodes(domNode) {
    const children = [];
    
    for (let i = 0; i < domNode.childNodes.length; i++) {
      const child = this.convertDomNodeToHierarchy(domNode.childNodes[i]);
      if (child) {
        children.push(child);
      }
    }
    
    return children;
  }

  /**
   * Extract attributes from DOM element
   * @private
   */
  extractAttributes(element) {
    const attributes = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    
    return attributes;
  }

  /**
   * Check if whitespace is significant
   * @private
   */
  isSignificantWhitespace(textNode) {
    const parent = textNode.parentNode;
    if (!parent) return false;
    
    // Check xml:space="preserve"
    if (parent.getAttribute && parent.getAttribute('xml:space') === 'preserve') {
      return true;
    }
    
    // Elements that typically preserve whitespace
    const preserveWhitespaceElements = ['pre', 'code', 'script', 'style'];
    return preserveWhitespaceElements.includes(parent.nodeName.toLowerCase());
  }

  /**
   * Serialize a node to XML string
   * @private
   */
  serializeNode(node, depth, indent, compact, visited) {
    if (!node || !node.type) {
      throw new Error('Invalid node: missing type');
    }

    // Check for circular references
    if (visited.has(node)) {
      throw new Error('Circular reference detected in XML structure');
    }
    visited.add(node);

    const indentStr = compact ? '' : indent.repeat(depth);
    const newline = compact ? '' : '\n';
    
    try {
      switch (node.type) {
        case 'element':
          return this.serializeElement(node, depth, indent, compact, visited);
          
        case 'text':
          return this.escapeXmlText(node.value || '');
          
        case 'cdata':
          return `<![CDATA[${node.value || ''}]]>`;
          
        case 'comment':
          return `<!--${node.value || ''}-->`;
          
        case 'processingInstruction':
          return `<?${node.name}${node.value ? ' ' + node.value : ''}?>`;
          
        case 'object':
          // Handle generic object nodes (from other format conversions)
          return this.serializeElement({
            ...node,
            type: 'element',
            name: node.name || 'object'
          }, depth, indent, compact, visited);
          
        case 'array':
          // Handle generic array nodes (from other format conversions)
          return this.serializeElement({
            ...node,
            type: 'element',
            name: node.name || 'array'
          }, depth, indent, compact, visited);
          
        case 'value':
          // Handle generic value nodes
          return this.escapeXmlText(node.value || '');
          
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } finally {
      visited.delete(node);
    }
  }

  /**
   * Serialize an element node
   * @private
   */
  serializeElement(node, depth, indent, compact, visited) {
    if (!node.name || !this.isValidElementName(node.name)) {
      throw new Error(`Invalid element name: ${node.name}`);
    }

    const indentStr = compact ? '' : indent.repeat(depth);
    const newline = compact ? '' : '\n';
    
    // Start tag
    let xml = `<${node.name}`;
    
    // Attributes
    if (node.attributes && typeof node.attributes === 'object') {
      const attrKeys = Object.keys(node.attributes).sort(); // Sort for consistency
      for (const key of attrKeys) {
        const value = node.attributes[key];
        if (value === '') {
          // Handle boolean attributes
          xml += ` ${key}=""`;
        } else {
          xml += ` ${key}="${this.escapeXmlAttribute(value)}"`;
        }
      }
    }
    
    // Handle self-closing elements
    if (!node.children || node.children.length === 0) {
      // Special case for value nodes converted to elements
      if (node.value !== null && node.value !== undefined) {
        xml += `>${this.escapeXmlText(node.value)}</${node.name}>`;
      } else {
        xml += ' />';
      }
      return xml;
    }
    
    xml += '>';
    
    // Children - handle mixed content properly
    let hasElementChildren = node.children.some(child => child.type === 'element');
    let childrenXml = '';
    
    for (const child of node.children) {
      if (child.type === 'element') {
        if (!compact && hasElementChildren) {
          childrenXml += newline + indent.repeat(depth + 1);
        }
        childrenXml += this.serializeNode(child, depth + 1, indent, compact, visited);
      } else {
        // For text, CDATA, comments - serialize inline
        childrenXml += this.serializeNode(child, depth + 1, indent, compact, visited);
      }
    }
    
    xml += childrenXml;
    
    // Closing tag
    if (hasElementChildren && !compact) {
      xml += newline + indentStr;
    }
    xml += `</${node.name}>`;
    
    return xml;
  }

  /**
   * Serialize text node
   */
  serializeTextNode(node) {
    switch (node.type) {
      case 'text':
        return this.escapeXmlText(node.value || '');
      case 'cdata':
        return `<![CDATA[${node.value || ''}]]>`;
      default:
        throw new Error(`Cannot serialize node type ${node.type} as text`);
    }
  }

  /**
   * Serialize comment node
   */
  serializeComment(node) {
    return `<!--${node.value || ''}-->`;
  }

  /**
   * Serialize processing instruction node
   */
  serializeProcessingInstruction(node) {
    return `<?${node.name}${node.value ? ' ' + node.value : ''}?>`;
  }

  /**
   * Escape XML text content
   * @private
   */
  escapeXmlText(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Escape XML attribute values
   * @private
   */
  escapeXmlAttribute(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Validate element name
   * @private
   */
  isValidElementName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    
    // XML name pattern: starts with letter or underscore, 
    // followed by letters, digits, hyphens, periods, or underscores
    const xmlNamePattern = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;
    return xmlNamePattern.test(name);
  }

  /**
   * Generate unique node ID
   * @private
   */
  generateNodeId() {
    return 'xml-node-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get format metadata
   */
  getMetadata() {
    return {
      format: this.format,
      mimeType: this.mimeType,
      fileExtensions: this.fileExtensions,
      supportsAttributes: true,
      supportsNamespaces: true,
      supportsMixedContent: true,
      supportsComments: true,
      supportsProcessingInstructions: true,
      supportsCDATA: true
    };
  }

  /**
   * Validate XML content
   */
  validate(content) {
    try {
      this.parse(content);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error.message] 
      };
    }
  }

  /**
   * Detect if content is likely XML
   */
  detect(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();
    
    // Check for XML declaration
    if (trimmed.startsWith('<?xml')) {
      return true;
    }
    
    // Check for root element
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      // Simple heuristic: looks like XML if it has angle brackets
      // and doesn't look like HTML
      const htmlElements = ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img'];
      const firstTag = trimmed.match(/<(\w+)/);
      if (firstTag) {
        const tagName = firstTag[1].toLowerCase();
        return !htmlElements.includes(tagName);
      }
    }
    
    return false;
  }

  /**
   * Get editable fields configuration
   */
  getEditableFields() {
    return {
      keyEditable: true,      // Element names can be edited
      valueEditable: true,    // Text content can be edited
      typeChangeable: false,  // Can't change node types in XML
      structureEditable: true // Can add/remove elements
    };
  }
}

// Register the handler
BaseFormatHandler.register('xml', XmlHandler);