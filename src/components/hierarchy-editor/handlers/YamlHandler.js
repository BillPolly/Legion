/**
 * YAML Handler - Parse and serialize YAML to/from HierarchyNode format
 */
import { BaseFormatHandler } from './BaseFormatHandler.js';
import { HierarchyNode } from '../model/HierarchyNode.js';

export class YamlHandler extends BaseFormatHandler {
  static format = 'yaml';
  
  constructor(config = {}) {
    super(config);
    this.indentSize = config.indentSize || 2;
    this.indentChar = ' ';
  }

  /**
   * Parse YAML string to HierarchyNode
   */
  parse(yamlString) {
    if (!yamlString || typeof yamlString !== 'string') {
      return null;
    }

    const trimmed = yamlString.trim();
    if (!trimmed || this.isOnlyComments(trimmed)) {
      return null;
    }

    try {
      // Simple YAML parser implementation
      const lines = trimmed.split('\n').map(line => line.replace(/\r$/, ''));
      const result = this.parseLines(lines);
      
      if (result) {
        // Detect indentation from original content
        const indentInfo = this.detectIndentation(lines);
        result.metadata = {
          ...result.metadata,
          indentChar: indentInfo.char,
          indentSize: indentInfo.size
        };
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error.message}`);
    }
  }

  /**
   * Serialize HierarchyNode to YAML string
   */
  serialize(node, options = {}) {
    if (!node) {
      return '';
    }

    const indent = options.indent || (node.metadata?.indentChar || ' ').repeat(node.metadata?.indentSize || 2);
    
    // Track visited nodes to prevent circular references
    const visited = new WeakSet();
    
    if (node.type === 'object' && !node.name) {
      // Root object - serialize children directly
      return this.serializeChildren(node.children || [], 0, indent, visited);
    } else {
      return this.serializeNode(node, 0, indent, visited);
    }
  }

  /**
   * Check if content is only comments
   * @private
   */
  isOnlyComments(content) {
    const lines = content.split('\n');
    return lines.every(line => {
      const trimmed = line.trim();
      return trimmed === '' || trimmed.startsWith('#');
    });
  }

  /**
   * Detect indentation style from content
   * @private
   */
  detectIndentation(lines) {
    let tabCount = 0;
    let spaceCount = 0;
    let spaceSizes = [];

    for (const line of lines) {
      const match = line.match(/^(\t+|\s+)/);
      if (match) {
        const indent = match[1];
        if (indent.includes('\t')) {
          tabCount++;
        } else {
          spaceCount++;
          spaceSizes.push(indent.length);
        }
      }
    }

    if (tabCount > spaceCount) {
      return { char: '\t', size: 1 };
    } else if (spaceSizes.length > 0) {
      // Find the most common space count
      const sizeCounts = {};
      spaceSizes.forEach(size => {
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      });
      
      const mostCommonSize = Object.keys(sizeCounts).reduce((a, b) => 
        sizeCounts[a] > sizeCounts[b] ? a : b
      );
      
      return { char: ' ', size: parseInt(mostCommonSize) };
    }

    return { char: ' ', size: 2 }; // Default
  }

  /**
   * Parse lines into hierarchy structure
   * @private
   */
  parseLines(lines) {
    // First, clean the lines - remove comments and empty lines for parsing
    const cleanedLines = lines.map(line => {
      // Remove inline comments but preserve quoted content
      let inQuotes = false;
      let quoteChar = null;
      let cleaned = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (!inQuotes && (char === '"' || char === "'")) {
          inQuotes = true;
          quoteChar = char;
          cleaned += char;
        } else if (inQuotes && char === quoteChar && line[i-1] !== '\\') {
          inQuotes = false;
          quoteChar = null;
          cleaned += char;
        } else if (!inQuotes && char === '#') {
          break; // Rest is comment
        } else {
          cleaned += char;
        }
      }
      
      return cleaned.trimRight();
    });
    
    const context = { index: 0, lines: cleanedLines };
    const result = this.parseDocument(context);
    
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return this.createObjectNode(null, result);
    }
    
    return null;
  }

  /**
   * Parse document from context
   * @private
   */
  parseDocument(context) {
    const result = {};
    
    while (context.index < context.lines.length) {
      const parsed = this.parseValue(context, 0);
      if (parsed && typeof parsed === 'object') {
        Object.assign(result, parsed);
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Parse value at current context
   * @private
   */
  parseValue(context, indentLevel) {
    // Skip empty lines
    this.skipEmptyLines(context);
    
    if (context.index >= context.lines.length) {
      return null;
    }

    const line = context.lines[context.index];
    const trimmed = line.trim();
    const currentIndent = this.getIndentLevel(line);
    
    if (currentIndent < indentLevel) {
      return null; // End of current level
    }

    // Handle array items
    if (trimmed.startsWith('- ')) {
      return this.parseArray(context, currentIndent);
    }

    // Handle key-value pairs
    const colonIndex = this.findUnquotedColon(trimmed);
    if (colonIndex > 0) {
      const keyPart = trimmed.substring(0, colonIndex).trim();
      const valuePart = trimmed.substring(colonIndex + 1).trim();
      
      context.index++;
      
      if (valuePart === '') {
        // Complex value on next lines
        const complexValue = this.parseValue(context, currentIndent + 1);
        return { [keyPart]: complexValue };
      } else if (valuePart.startsWith('[') && valuePart.endsWith(']')) {
        // Flow array
        const arrayValue = this.parseFlowArray(valuePart);
        return { [keyPart]: arrayValue };
      } else if (valuePart.startsWith('{') && valuePart.endsWith('}')) {
        // Flow object
        const objectValue = this.parseFlowObject(valuePart);
        return { [keyPart]: objectValue };
      } else {
        // Simple value
        const parsedValue = this.parseScalarValue(valuePart);
        return { [keyPart]: parsedValue };
      }
    }

    return null;
  }

  /**
   * Find unquoted colon in string
   * @private
   */
  findUnquotedColon(str) {
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar && str[i-1] !== '\\') {
        inQuotes = false;
        quoteChar = null;
      } else if (!inQuotes && char === ':') {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Skip empty lines and comments
   * @private
   */
  skipEmptyLines(context) {
    while (context.index < context.lines.length) {
      const line = context.lines[context.index];
      const trimmed = line.trim();
      
      if (trimmed === '' || trimmed.startsWith('#')) {
        context.index++;
      } else {
        break;
      }
    }
  }

  /**
   * Parse array starting from current line
   * @private
   */
  parseArray(context, indentLevel) {
    const items = [];
    
    while (context.index < context.lines.length) {
      this.skipEmptyLines(context);
      
      if (context.index >= context.lines.length) {
        break;
      }
      
      const line = context.lines[context.index];
      const trimmed = line.trim();
      const currentIndent = this.getIndentLevel(line);
      
      if (currentIndent < indentLevel || !trimmed.startsWith('- ')) {
        break;
      }
      
      if (currentIndent === indentLevel && trimmed.startsWith('- ')) {
        const itemValue = trimmed.substring(2).trim();
        context.index++;
        
        if (itemValue === '') {
          // Complex item on next lines
          const complexItem = this.parseValue(context, currentIndent + 1);
          items.push(complexItem);
        } else {
          items.push(this.parseScalarValue(itemValue));
        }
      }
    }
    
    return items;
  }

  /**
   * Parse flow-style array [1, 2, 3]
   * @private
   */
  parseFlowArray(flowStr) {
    const content = flowStr.slice(1, -1).trim();
    if (!content) return [];
    
    const items = content.split(',').map(item => this.parseScalarValue(item.trim()));
    return items;
  }

  /**
   * Parse flow-style object {key: value}
   * @private
   */
  parseFlowObject(flowStr) {
    const content = flowStr.slice(1, -1).trim();
    if (!content) return {};
    
    const obj = {};
    const pairs = content.split(',');
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > 0) {
        const key = pair.substring(0, colonIndex).trim();
        const value = pair.substring(colonIndex + 1).trim();
        obj[key] = this.parseScalarValue(value);
      }
    }
    
    return obj;
  }

  /**
   * Parse scalar value (string, number, boolean, null)
   * @private
   */
  parseScalarValue(str) {
    if (!str || str === 'null' || str === '~') {
      return null;
    }
    
    if (str === 'true' || str === 'yes' || str === 'on') {
      return true;
    }
    
    if (str === 'false' || str === 'no' || str === 'off') {
      return false;
    }
    
    // Remove quotes
    if ((str.startsWith('"') && str.endsWith('"')) || 
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    
    // Try to parse as number
    if (/^-?\d+$/.test(str)) {
      return parseInt(str, 10);
    }
    
    if (/^-?\d*\.\d+$/.test(str)) {
      return parseFloat(str);
    }
    
    if (/^-?\d+\.?\d*e[+-]?\d+$/i.test(str)) {
      return parseFloat(str);
    }
    
    // Octal
    if (/^0o[0-7]+$/i.test(str)) {
      return parseInt(str.slice(2), 8);
    }
    
    // Hexadecimal
    if (/^0x[0-9a-f]+$/i.test(str)) {
      return parseInt(str.slice(2), 16);
    }
    
    return str;
  }

  /**
   * Get indentation level of a line
   * @private
   */
  getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Create object node from parsed data
   * @private
   */
  createObjectNode(name, data) {
    const nodeId = this.generateNodeId();
    
    if (data === null || data === undefined) {
      return {
        id: nodeId,
        type: 'value',
        name: name || '',
        value: data,
        children: [],
        metadata: {}
      };
    }
    
    if (Array.isArray(data)) {
      const children = data.map((item, index) => 
        this.createObjectNode(index.toString(), item)
      );
      
      return {
        id: nodeId,
        type: 'array',
        name: name || '',
        value: null,
        children: children,
        metadata: {}
      };
    }
    
    if (typeof data === 'object') {
      const children = Object.keys(data).map(key => 
        this.createObjectNode(key, data[key])
      );
      
      return {
        id: nodeId,
        type: 'object',
        name: name || '',
        value: null,
        children: children,
        metadata: {}
      };
    }
    
    return {
      id: nodeId,
      type: 'value',
      name: name || '',
      value: data,
      children: [],
      metadata: {}
    };
  }

  /**
   * Serialize a node to YAML string
   * @private
   */
  serializeNode(node, depth, indent, visited) {
    if (!node || !node.type) {
      throw new Error('Invalid node: missing type');
    }

    // Check for circular references
    if (visited.has(node)) {
      throw new Error('Circular reference detected in YAML structure');
    }
    visited.add(node);

    try {
      switch (node.type) {
        case 'object':
          return this.serializeObject(node, depth, indent, visited);
        case 'array':
          return this.serializeArray(node, depth, indent, visited);
        case 'value':
          return this.serializeValue(node, depth, indent);
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } finally {
      visited.delete(node);
    }
  }

  /**
   * Serialize object node
   * @private
   */
  serializeObject(node, depth, indent, visited) {
    const indentStr = indent.repeat(depth);
    
    if (!node.children || node.children.length === 0) {
      return `${node.name ? node.name + ': ' : ''}{}`;
    }
    
    let result = node.name ? `${node.name}:\n` : '';
    result += this.serializeChildren(node.children, depth + (node.name ? 1 : 0), indent, visited);
    
    return result;
  }

  /**
   * Serialize array node
   * @private
   */
  serializeArray(node, depth, indent, visited) {
    const indentStr = indent.repeat(depth);
    
    if (!node.children || node.children.length === 0) {
      return `${node.name ? node.name + ': ' : ''}[]`;
    }
    
    // Check if we should use flow style - only for simple arrays with explicit flow style
    const useFlow = node.metadata?.yamlStyle === 'flow';
    
    if (useFlow) {
      const items = node.children.map(child => this.formatScalarValue(child.value));
      return `${node.name ? node.name + ': ' : ''}[${items.join(', ')}]`;
    }
    
    let result = node.name ? `${node.name}:\n` : '';
    
    for (const child of node.children) {
      const childIndent = indent.repeat(depth + (node.name ? 1 : 0));
      result += `${childIndent}- ${this.serializeArrayItem(child, depth + (node.name ? 1 : 0), indent, visited)}\n`;
    }
    
    return result.replace(/\n$/, '');
  }

  /**
   * Serialize array item
   * @private
   */
  serializeArrayItem(node, depth, indent, visited) {
    if (node.type === 'value') {
      return this.formatScalarValue(node.value);
    } else if (node.type === 'object') {
      if (!node.children || node.children.length === 0) {
        return '{}';
      }
      
      let result = '';
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childContent = this.serializeNode(child, depth + 1, indent, visited);
        
        if (i === 0) {
          result += childContent.replace(/^\s*/, '');
        } else {
          result += '\n' + indent.repeat(depth) + '  ' + childContent.replace(/^\s*/, '');
        }
      }
      
      return result;
    } else if (node.type === 'array') {
      const childContent = this.serializeNode(node, depth, indent, visited);
      return childContent.replace(new RegExp(`^${node.name}: `), '');
    }
    
    return '';
  }

  /**
   * Serialize children nodes
   * @private
   */
  serializeChildren(children, depth, indent, visited) {
    const indentStr = indent.repeat(depth);
    let result = '';
    
    for (const child of children) {
      const childContent = this.serializeNode(child, depth, indent, visited);
      result += `${indentStr}${childContent}\n`;
    }
    
    return result.replace(/\n$/, '');
  }

  /**
   * Serialize value node
   * @private
   */
  serializeValue(node, depth, indent) {
    const formattedValue = this.formatScalarValue(node.value);
    return node.name ? `${this.formatKey(node.name)}: ${formattedValue}` : formattedValue;
  }

  /**
   * Format a scalar value for YAML output
   * @private
   */
  formatScalarValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'string') {
      // Check if string needs quoting
      if (this.needsQuoting(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    
    return String(value);
  }

  /**
   * Format a key for YAML output
   * @private
   */
  formatKey(key) {
    if (this.needsQuoting(key) || /^\d/.test(key)) {
      return `"${key.replace(/"/g, '\\"')}"`;
    }
    return key;
  }

  /**
   * Check if a string needs quoting in YAML
   * @private
   */
  needsQuoting(str) {
    if (typeof str !== 'string') {
      return false;
    }
    
    // Empty string needs quoting
    if (str === '') {
      return true;
    }
    
    // Strings with spaces need quoting
    if (/\s/.test(str)) {
      return true;
    }
    
    // Strings with special characters need quoting
    if (/[:\[\]{},#&*!|>'"%@`]/.test(str)) {
      return true;
    }
    
    // Strings that look like numbers, booleans, or null need quoting
    if (/^(true|false|yes|no|on|off|null|~)$/i.test(str)) {
      return true;
    }
    
    if (/^-?\d+\.?\d*$/.test(str)) {
      return true;
    }
    
    // Strings starting or ending with whitespace need quoting
    if (/^\s|\s$/.test(str)) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate unique node ID
   * @private
   */
  generateNodeId() {
    return 'yaml-node-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get format metadata
   */
  getMetadata() {
    return {
      format: this.format,
      mimeType: this.mimeType,
      fileExtensions: this.fileExtensions,
      supportsComments: true,
      supportsAnchors: true,
      supportsMultilineStrings: true,
      supportsFlowStyle: true,
      supportsImplicitKeys: true
    };
  }

  /**
   * Validate YAML content
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
   * Detect if content is likely YAML
   */
  detect(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();
    
    // Check for YAML document markers
    if (trimmed.startsWith('---') || trimmed.includes('\n---')) {
      return true;
    }
    
    // Look for YAML-like patterns
    const lines = trimmed.split('\n');
    let yamlFeatures = 0;
    
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Key-value pairs
      if (/^\s*[\w-]+:\s/.test(line)) {
        yamlFeatures++;
      }
      
      // Array items
      if (/^\s*-\s/.test(line)) {
        yamlFeatures++;
      }
      
      // Indented structure
      if (/^\s{2,}/.test(line)) {
        yamlFeatures++;
      }
    }
    
    return yamlFeatures >= 1;
  }

  /**
   * Get editable fields configuration
   */
  getEditableFields() {
    return {
      keyEditable: true,
      valueEditable: true,
      typeChangeable: true,
      structureEditable: true
    };
  }
}

// Register the handler
BaseFormatHandler.register('yaml', YamlHandler);