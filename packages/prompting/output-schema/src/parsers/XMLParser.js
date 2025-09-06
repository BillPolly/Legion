/**
 * XMLParser - Parse XML responses from LLM output
 * 
 * Uses regex-based parsing for simplicity and flexibility
 * Supports nested structures, attributes, and CDATA sections
 */

import { SchemaExtensions } from '../SchemaExtensions.js';

export class XMLParser {
  /**
   * Create an XML parser
   * @param {Object} schema - Extended JSON Schema with XML format specifications
   * @param {Object} options - Parser options
   */
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      preserveWhitespace: false,
      includeAttributes: false,
      ...options
    };
    
    // Extract XML format specifications
    this.formatSpecs = SchemaExtensions.getFormatSpecs(schema, 'xml');
  }

  /**
   * Parse XML from response text
   * @param {string} responseText - Text containing XML
   * @returns {Object} Parse result {success, data?, errors?}
   */
  parse(responseText) {
    // Input validation
    if (!responseText) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or null',
          field: null,
          suggestion: 'Ensure the response contains valid XML content'
        }]
      };
    }

    if (typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input must be a string',
          field: null,
          suggestion: 'Convert input to string before parsing'
        }]
      };
    }

    const trimmed = responseText.trim();
    
    // Basic XML structure validation
    if (!this._hasXMLStructure(trimmed)) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'No XML structure found in response',
          field: null,
          suggestion: 'Ensure the response contains valid XML with opening and closing tags'
        }]
      };
    }

    // Basic validation for severely malformed XML
    if (!this.validateXML(trimmed)) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Malformed XML structure detected',
          field: null,
          suggestion: 'Check that all XML tags are properly opened and closed'
        }]
      };
    }

    try {
      // Determine root element
      const rootElement = this._findRootElement(trimmed);
      
      // Extract data from XML
      const data = this.extractElements(trimmed, rootElement);
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        errors: [this._createParseError(error, trimmed)]
      };
    }
  }

  /**
   * Extract elements from XML text
   * @param {string} xmlText - XML content
   * @param {string} rootElement - Root element name (null for no root)
   * @param {boolean} includeAttributes - Whether to extract attributes
   * @returns {Object} Extracted data
   */
  extractElements(xmlText, rootElement = null, includeAttributes = false) {
    let content = xmlText.trim();
    
    // Extract content from root element if specified
    if (rootElement) {
      const rootPattern = new RegExp(`<${rootElement}[^>]*>([\\s\\S]*?)<\\/${rootElement}>`, 'i');
      const rootMatch = content.match(rootPattern);
      
      if (rootMatch) {
        content = rootMatch[1];
      }
    }

    const result = {};
    
    // Improved element extraction that handles nested structures better
    const elementPattern = /<([^\/\s>!?]+)(?:[^>]*)?>([^<]*(?:<[^>]*>[^<]*<\/[^>]*>[^<]*)*)<\/\1>|<([^\/\s>!?]+)(?:[^>]*)?\/>/g;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
      const tagName = match[1] || match[3];
      let tagContent = match[2] || '';
      
      if (!tagName) continue;
      
      // Handle CDATA sections
      if (tagContent.includes('<![CDATA[')) {
        const cdataMatch = tagContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (cdataMatch) {
          tagContent = cdataMatch[1];
        }
      }
      
      // Check for nested elements (like <item> within <tags>)
      if (tagContent.includes('<')) {
        const nestedItems = this._extractNestedItems(tagContent);
        if (nestedItems.length > 0) {
          tagContent = nestedItems; // Convert to array
        } else {
          // Recursive parsing for other nested content
          const nestedResult = this.extractElements(`<temp>${tagContent}</temp>`, 'temp');
          if (Object.keys(nestedResult).length > 0) {
            tagContent = nestedResult;
          } else {
            tagContent = tagContent.trim();
          }
        }
      } else {
        // Simple text content
        if (!this.options.preserveWhitespace) {
          tagContent = tagContent.trim();
        }
      }
      
      // Handle repeated elements (arrays)
      if (result.hasOwnProperty(tagName)) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]];
        }
        result[tagName].push(tagContent);
      } else {
        result[tagName] = tagContent;
      }
    }

    // Handle nested structures by looking for remaining uncaptured elements
    const remainingElements = content.replace(elementPattern, '').trim();
    if (remainingElements && remainingElements.includes('<')) {
      // There are nested elements we missed - handle them recursively
      const nestedPattern = /<([^\/\s>!?]+)(?:[^>]*)?>[\s\S]*?<\/\1>/g;
      let nestedMatch;
      
      while ((nestedMatch = nestedPattern.exec(content)) !== null) {
        const nestedTagName = nestedMatch[1];
        if (!result.hasOwnProperty(nestedTagName)) {
          const nestedContent = nestedMatch[0];
          const nestedData = this.extractElements(nestedContent, nestedTagName);
          result[nestedTagName] = nestedData;
        }
      }
    }

    // Handle attributes if requested
    if (includeAttributes || this.options.includeAttributes) {
      const attrData = this._extractAttributes(content);
      Object.assign(result, attrData);
    }

    return result;
  }

  /**
   * Validate XML structure
   * @param {string} xmlString - XML string to validate
   * @returns {boolean} True if valid XML structure
   */
  validateXML(xmlString) {
    try {
      // Basic validation: check for balanced tags
      const openTags = [];
      const tagPattern = /<\/?([^\/\s>!]+)(?:\s[^>]*)?\/?>/g;
      let match;
      
      while ((match = tagPattern.exec(xmlString)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        
        if (fullTag.startsWith('</')) {
          // Closing tag
          if (openTags.length === 0 || openTags.pop() !== tagName) {
            return false; // Mismatched closing tag
          }
        } else if (!fullTag.endsWith('/>')) {
          // Opening tag (not self-closing)
          openTags.push(tagName);
        }
        // Self-closing tags don't affect the stack
      }
      
      // All tags should be closed
      return openTags.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if text has XML structure
   * @private
   */
  _hasXMLStructure(text) {
    return text.includes('<') && 
           text.includes('>') && 
           /<[^\/!?][^>]*>/.test(text);
  }

  /**
   * Find root element name
   * @private
   */
  _findRootElement(xmlText) {
    // Look for configured root element first
    const configuredRoot = this.formatSpecs['root-element'];
    if (configuredRoot) {
      const rootPattern = new RegExp(`<${configuredRoot}[^>]*>`, 'i');
      if (rootPattern.test(xmlText)) {
        return configuredRoot;
      }
    }

    // Find the first opening tag
    const firstTagMatch = xmlText.match(/<([^\/\s>!?]+)(?:\s[^>]*)?>/) ;
    return firstTagMatch ? firstTagMatch[1] : null;
  }

  /**
   * Extract attributes from XML content
   * @private
   */
  _extractAttributes(content) {
    const attributes = {};
    const attrPattern = /<([^\/\s>!]+)\s+([^>]+)>/g;
    let match;
    
    while ((match = attrPattern.exec(content)) !== null) {
      const tagName = match[1];
      const attrString = match[2];
      
      // Extract individual attributes
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        const attrName = attrMatch[1];
        const attrValue = attrMatch[2];
        attributes[`${tagName}_${attrName}`] = attrValue;
      }
    }
    
    return attributes;
  }

  /**
   * Extract nested items (like <item> elements within a container)
   * @private
   */
  _extractNestedItems(content) {
    const itemPattern = /<item[^>]*>([^<]*)<\/item>/gi;
    const items = [];
    let match;
    
    while ((match = itemPattern.exec(content)) !== null) {
      items.push(match[1].trim());
    }
    
    return items;
  }

  /**
   * Create detailed parse error
   * @private
   */
  _createParseError(error, xmlContent) {
    let suggestion = 'Check XML syntax and structure';
    
    if (error.message.includes('tag')) {
      suggestion = 'Ensure all opening tags have matching closing tags';
    } else if (error.message.includes('attribute')) {
      suggestion = 'Check attribute syntax: name="value"';
    }
    
    return {
      type: 'parsing',
      message: `Invalid XML: ${error.message}`,
      field: null,
      suggestion: suggestion
    };
  }
}