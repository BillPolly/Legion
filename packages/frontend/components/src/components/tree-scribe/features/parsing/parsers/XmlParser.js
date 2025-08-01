/**
 * XmlParser - XML document parser for TreeScribe
 * Converts XML structures into hierarchical trees
 */

import { BaseParser } from '../BaseParser.js';

export class XmlParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'XmlParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['xml', 'svg', 'rss', 'atom', 'xsd', 'wsdl'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'text/xml',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'image/svg+xml',
      'application/xhtml+xml'
    ];
  }

  /**
   * Check if content can be parsed as XML
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

    // Check content for XML patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    const trimmed = content.trim();
    
    // XML indicators
    let confidence = 0;
    
    // XML declaration
    if (/^<\?xml\s+version/.test(trimmed)) {
      confidence += 0.4;
    }
    
    // Check for well-formed XML structure
    const tagMatch = trimmed.match(/<(\w+)[^>]*>/);
    if (tagMatch) {
      const tagName = tagMatch[1];
      const closingTag = new RegExp(`</${tagName}>`, 'i');
      
      if (closingTag.test(trimmed)) {
        confidence += 0.3;
      }
      
      // Check for common XML root elements
      const commonRoots = ['root', 'document', 'svg', 'rss', 'feed', 'html', 'configuration', 'project'];
      if (commonRoots.includes(tagName.toLowerCase())) {
        confidence += 0.1;
      }
    }
    
    // Check for namespaces
    if (/xmlns[:=]/.test(trimmed)) {
      confidence += 0.2;
    }
    
    // Check for DOCTYPE
    if (/<!DOCTYPE/.test(trimmed)) {
      confidence += 0.1;
    }
    
    // Check for multiple XML-like tags
    const tagCount = (trimmed.match(/<\w+[^>]*>/g) || []).length;
    if (tagCount > 3) {
      confidence += Math.min(tagCount * 0.02, 0.2);
    }
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Validate XML content
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    if (!content || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a non-empty string'] 
      };
    }

    const trimmed = content.trim();
    
    // Basic XML validation
    if (!/<[^>]+>/.test(trimmed)) {
      return { 
        valid: false, 
        errors: ['No XML tags found'] 
      };
    }

    // Check for balanced tags (simple validation)
    const openTags = (trimmed.match(/<(\w+)[^>]*>/g) || []).map(tag => {
      const match = tag.match(/<(\w+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    const closeTags = (trimmed.match(/<\/(\w+)>/g) || []).map(tag => {
      const match = tag.match(/<\/(\w+)>/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    // Very basic balance check
    if (openTags.length === 0 && closeTags.length === 0) {
      return { 
        valid: false, 
        errors: ['No valid XML structure found'] 
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Parse XML content into tree structure
   * @param {string} content - XML content
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

      // Parse XML
      const doc = this._parseXmlString(content);
      
      // Extract structure
      const structure = this._extractXmlStructure(doc, options);
      
      // Normalize
      const normalized = this._normalizeNode(structure);
      normalized.sourceFormat = 'xml';
      
      return normalized;

    } catch (error) {
      console.error('[XmlParser] Parse error:', error);
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'xml',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Parse XML string into structure
   * @private
   */
  _parseXmlString(xml) {
    const trimmed = xml.trim();
    
    // Extract XML declaration
    const declMatch = trimmed.match(/<\?xml([^?>]+)\?>/);
    const declaration = declMatch ? this._parseXmlDeclaration(declMatch[1]) : null;
    
    // Extract DOCTYPE
    const doctypeMatch = trimmed.match(/<!DOCTYPE[^>]+>/);
    const doctype = doctypeMatch ? doctypeMatch[0] : null;
    
    // Extract root element
    const rootMatch = trimmed.match(/<(\w+)([^>]*)>([\s\S]*)<\/\1>/);
    if (!rootMatch) {
      // Try self-closing root
      const selfClosingMatch = trimmed.match(/<(\w+)([^>]*)\/>/);
      if (selfClosingMatch) {
        return {
          declaration,
          doctype,
          root: {
            name: selfClosingMatch[1],
            attributes: this._parseAttributes(selfClosingMatch[2]),
            children: [],
            content: ''
          }
        };
      }
      throw new Error('No valid root element found');
    }
    
    const rootName = rootMatch[1];
    const rootAttrs = this._parseAttributes(rootMatch[2]);
    const rootContent = rootMatch[3];
    
    // Parse root element
    const root = {
      name: rootName,
      attributes: rootAttrs,
      children: this._parseXmlElements(rootContent),
      content: this._extractTextContent(rootContent)
    };
    
    return {
      declaration,
      doctype,
      root
    };
  }

  /**
   * Parse XML declaration attributes
   * @private
   */
  _parseXmlDeclaration(decl) {
    const attrs = {};
    const attrRegex = /(\w+)=["']([^"']+)["']/g;
    let match;
    
    while ((match = attrRegex.exec(decl)) !== null) {
      attrs[match[1]] = match[2];
    }
    
    return attrs;
  }

  /**
   * Parse element attributes
   * @private
   */
  _parseAttributes(attrString) {
    if (!attrString || !attrString.trim()) return {};
    
    const attrs = {};
    const attrRegex = /(\w+(?::\w+)?)(?:=["']([^"']+)["'])?/g;
    let match;
    
    while ((match = attrRegex.exec(attrString)) !== null) {
      attrs[match[1]] = match[2] || 'true';
    }
    
    return attrs;
  }

  /**
   * Parse XML elements recursively
   * @private
   */
  _parseXmlElements(content) {
    const elements = [];
    const elementRegex = /<(\w+(?::\w+)?)([^>]*)(?:\/|>([\s\S]*?)<\/\1)>/g;
    let match;
    let lastIndex = 0;
    
    while ((match = elementRegex.exec(content)) !== null) {
      const tagName = match[1];
      const attributes = this._parseAttributes(match[2]);
      const innerContent = match[3] || '';
      const isSelfClosing = !match[3];
      
      // Check for text content before this element
      const textBefore = content.substring(lastIndex, match.index).trim();
      if (textBefore && !/</.test(textBefore)) {
        elements.push({
          type: 'text',
          content: textBefore
        });
      }
      
      // Parse element
      const element = {
        type: 'element',
        name: tagName,
        attributes,
        children: isSelfClosing ? [] : this._parseXmlElements(innerContent),
        content: isSelfClosing ? '' : this._extractTextContent(innerContent)
      };
      
      elements.push(element);
      lastIndex = match.index + match[0].length;
    }
    
    // Check for trailing text
    const textAfter = content.substring(lastIndex).trim();
    if (textAfter && !/</.test(textAfter)) {
      elements.push({
        type: 'text',
        content: textAfter
      });
    }
    
    return elements;
  }

  /**
   * Extract text content from element
   * @private
   */
  _extractTextContent(content) {
    // Remove all tags
    const text = content.replace(/<[^>]+>/g, '').trim();
    
    // Decode XML entities
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  /**
   * Extract XML structure for tree
   * @private
   */
  _extractXmlStructure(doc, options = {}) {
    const skipElements = options.skipElements || [];
    const flattenElements = options.flattenElements || [];
    
    // Create root node
    const root = {
      title: this._generateElementTitle(doc.root),
      content: this._generateElementDescription(doc),
      contentType: 'xml',
      children: [],
      metadata: {
        xmlVersion: doc.declaration?.version || '1.0',
        encoding: doc.declaration?.encoding || 'UTF-8',
        doctype: doc.doctype,
        rootElement: doc.root.name,
        namespaces: this._extractNamespaces(doc.root.attributes)
      }
    };
    
    // Convert elements to tree nodes
    root.children = this._convertElementsToNodes(doc.root.children, {
      ...options,
      skipElements,
      flattenElements
    });
    
    return root;
  }

  /**
   * Generate element title
   * @private
   */
  _generateElementTitle(element) {
    // Use common attribute patterns for title
    const titleAttrs = ['name', 'id', 'title', 'label', 'key'];
    
    for (const attr of titleAttrs) {
      if (element.attributes[attr]) {
        return `${element.name}: ${element.attributes[attr]}`;
      }
    }
    
    // For specific known elements
    const specialCases = {
      'title': () => element.content || element.name,
      'name': () => element.content || element.name,
      'description': () => 'Description',
      'summary': () => 'Summary'
    };
    
    if (specialCases[element.name]) {
      return specialCases[element.name]();
    }
    
    return element.name;
  }

  /**
   * Generate element description
   * @private
   */
  _generateElementDescription(doc) {
    const parts = [];
    
    if (doc.declaration) {
      parts.push(`XML ${doc.declaration.version || '1.0'}`);
      if (doc.declaration.encoding) {
        parts.push(`Encoding: ${doc.declaration.encoding}`);
      }
    }
    
    if (doc.root.attributes) {
      const attrCount = Object.keys(doc.root.attributes).length;
      if (attrCount > 0) {
        parts.push(`${attrCount} attributes`);
      }
    }
    
    return parts.join(', ') || 'XML Document';
  }

  /**
   * Extract namespaces from attributes
   * @private
   */
  _extractNamespaces(attributes) {
    const namespaces = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'xmlns') {
        namespaces['default'] = value;
      } else if (key.startsWith('xmlns:')) {
        const prefix = key.substring(6);
        namespaces[prefix] = value;
      }
    }
    
    return namespaces;
  }

  /**
   * Convert XML elements to tree nodes
   * @private
   */
  _convertElementsToNodes(elements, options) {
    const nodes = [];
    
    for (const element of elements) {
      if (element.type === 'text') {
        // Skip pure whitespace text nodes
        if (element.content.trim()) {
          nodes.push({
            title: 'Text',
            content: element.content,
            contentType: 'text'
          });
        }
        continue;
      }
      
      // Skip if in skip list
      if (options.skipElements.includes(element.name)) {
        continue;
      }
      
      // Create node
      const node = {
        title: this._generateElementTitle(element),
        content: this._generateNodeContent(element),
        contentType: 'xml',
        metadata: {
          elementName: element.name,
          attributes: element.attributes,
          hasChildren: element.children.length > 0
        },
        children: []
      };
      
      // Handle flattening
      if (options.flattenElements.includes(element.name) && element.children.length === 1) {
        // Flatten single child
        const child = element.children[0];
        if (child.type === 'element') {
          node.title = this._generateElementTitle(child);
          node.content = this._generateNodeContent(child);
          node.metadata.flattened = true;
          node.metadata.originalElement = element.name;
        }
      } else if (element.children.length > 0) {
        // Recursively convert children
        node.children = this._convertElementsToNodes(element.children, options);
      }
      
      nodes.push(node);
    }
    
    return nodes;
  }

  /**
   * Generate node content
   * @private
   */
  _generateNodeContent(element) {
    const parts = [];
    
    // Add text content if present
    if (element.content) {
      parts.push(element.content);
    }
    
    // Add attribute summary
    const attrCount = Object.keys(element.attributes).length;
    if (attrCount > 0) {
      const attrList = Object.entries(element.attributes)
        .slice(0, 3)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      
      parts.push(`Attributes: ${attrList}${attrCount > 3 ? '...' : ''}`);
    }
    
    // Add child count
    const elementChildren = element.children.filter(c => c.type === 'element').length;
    if (elementChildren > 0) {
      parts.push(`${elementChildren} child elements`);
    }
    
    return parts.join(' | ') || `<${element.name} />`;
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: true,
      preservesFormatting: false,
      features: [
        'namespace-support',
        'attribute-extraction',
        'xml-declaration',
        'doctype-parsing',
        'element-hierarchy',
        'text-content'
      ]
    };
  }
}