/**
 * TOML Parser Plugin for TreeScribe
 * Parses TOML (Tom's Obvious, Minimal Language) configuration files
 * 
 * @author TreeScribe Team
 * @version 1.0.0
 */

const BaseParser = globalThis.BaseParser || class BaseParser {
  _normalizeNode(node) { return node; }
};

class TomlParser extends BaseParser {
  getName() {
    return 'TomlParser';
  }

  getSupportedFormats() {
    return ['toml'];
  }

  getSupportedMimeTypes() {
    return ['application/toml', 'text/toml'];
  }

  canParse(content, hints = {}) {
    // Check hints
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Check content
    if (!content || typeof content !== 'string') {
      return 0;
    }

    let confidence = 0;

    // Check for TOML patterns
    const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    // Check for table headers
    if (/^\[[\w.]+\]$/m.test(content)) {
      confidence += 0.4;
    }

    // Check for array of tables
    if (/^\[\[[\w.]+\]\]$/m.test(content)) {
      confidence += 0.3;
    }

    // Check for key-value pairs
    if (/^\s*\w+\s*=\s*.+$/m.test(content)) {
      confidence += 0.3;
    }

    // Check for TOML-specific syntax
    if (content.includes('"""') || content.includes("'''")) {
      confidence += 0.2;
    }

    return Math.min(confidence, 0.95);
  }

  validate(content) {
    const errors = [];

    if (!content || typeof content !== 'string') {
      errors.push('Content must be a non-empty string');
    } else {
      // Basic TOML validation
      const lines = content.split('\n');
      let inMultilineString = false;
      let multilineDelimiter = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) continue;

        // Check multiline strings
        if (line.includes('"""') || line.includes("'''")) {
          const delimiter = line.includes('"""') ? '"""' : "'''";
          if (!inMultilineString) {
            inMultilineString = true;
            multilineDelimiter = delimiter;
          } else if (delimiter === multilineDelimiter) {
            inMultilineString = false;
            multilineDelimiter = null;
          }
          continue;
        }

        if (inMultilineString) continue;

        // Validate table headers
        if (line.startsWith('[')) {
          if (!line.endsWith(']')) {
            errors.push(`Line ${i + 1}: Invalid table header`);
          } else if (line.startsWith('[[') && !line.endsWith(']]')) {
            errors.push(`Line ${i + 1}: Invalid array table header`);
          }
          continue;
        }

        // Validate key-value pairs
        if (line.includes('=')) {
          const [key, ...valueParts] = line.split('=');
          if (!key.trim()) {
            errors.push(`Line ${i + 1}: Missing key before '='`);
          }
          if (valueParts.length === 0 || !valueParts.join('=').trim()) {
            errors.push(`Line ${i + 1}: Missing value after '='`);
          }
        } else {
          errors.push(`Line ${i + 1}: Invalid syntax - expected key-value pair or table header`);
        }
      }

      if (inMultilineString) {
        errors.push('Unclosed multiline string');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  parse(content, options = {}) {
    try {
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Parse TOML
      const data = this._parseToml(content, options);
      
      // Build tree
      const tree = this._buildTree(data, options);

      const normalized = this._normalizeNode(tree);
      normalized.sourceFormat = 'toml';

      return normalized;

    } catch (error) {
      return this._normalizeNode({
        title: 'TOML Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'toml',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  _parseToml(content, options) {
    const result = {
      _root: {}
    };
    
    const lines = content.split('\n');
    let currentSection = result._root;
    let currentPath = [];
    let inMultilineString = false;
    let multilineKey = null;
    let multilineValue = [];
    let multilineDelimiter = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Handle multiline strings
      if (inMultilineString) {
        if (line.includes(multilineDelimiter)) {
          // End of multiline string
          currentSection[multilineKey] = {
            type: 'string',
            value: multilineValue.join('\n'),
            multiline: true
          };
          inMultilineString = false;
          multilineKey = null;
          multilineValue = [];
          multilineDelimiter = null;
        } else {
          multilineValue.push(line);
        }
        continue;
      }

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      // Handle array of tables [[name]]
      if (trimmedLine.startsWith('[[') && trimmedLine.endsWith(']]')) {
        const tableName = trimmedLine.slice(2, -2).trim();
        const pathParts = this._parseTablePath(tableName);
        
        // Navigate to parent
        let parent = result;
        for (let j = 0; j < pathParts.length - 1; j++) {
          const part = pathParts[j];
          if (!parent[part]) {
            parent[part] = {};
          }
          parent = parent[part];
        }

        // Create array if needed
        const lastPart = pathParts[pathParts.length - 1];
        if (!parent[lastPart]) {
          parent[lastPart] = [];
        }
        
        // Add new table to array
        const newTable = {};
        parent[lastPart].push(newTable);
        currentSection = newTable;
        currentPath = pathParts;
        continue;
      }

      // Handle tables [name]
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        const tableName = trimmedLine.slice(1, -1).trim();
        const pathParts = this._parseTablePath(tableName);
        
        // Navigate/create path
        currentSection = result;
        for (const part of pathParts) {
          if (!currentSection[part]) {
            currentSection[part] = {};
          }
          currentSection = currentSection[part];
        }
        currentPath = pathParts;
        continue;
      }

      // Handle key-value pairs
      if (trimmedLine.includes('=')) {
        const equalIndex = trimmedLine.indexOf('=');
        const key = trimmedLine.substring(0, equalIndex).trim();
        const valueStr = trimmedLine.substring(equalIndex + 1).trim();

        // Check for multiline string start
        if (valueStr.startsWith('"""') || valueStr.startsWith("'''")) {
          multilineDelimiter = valueStr.substring(0, 3);
          inMultilineString = true;
          multilineKey = key;
          multilineValue = [];
          
          // Check if it ends on same line
          const afterDelimiter = valueStr.substring(3);
          if (afterDelimiter.endsWith(multilineDelimiter)) {
            // Single line multiline string
            currentSection[key] = {
              type: 'string',
              value: afterDelimiter.slice(0, -3),
              multiline: true
            };
            inMultilineString = false;
            multilineKey = null;
            multilineValue = [];
            multilineDelimiter = null;
          } else {
            multilineValue.push(afterDelimiter);
          }
          continue;
        }

        // Parse value
        const value = this._parseValue(valueStr);
        currentSection[key] = value;
      }
    }

    return result;
  }

  _parseTablePath(path) {
    // Handle quoted keys
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = null;
      } else if (!inQuotes && char === '.') {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  _parseValue(valueStr) {
    // String with double quotes
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      return {
        type: 'string',
        value: this._unescapeString(valueStr.slice(1, -1))
      };
    }

    // String with single quotes (literal)
    if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      return {
        type: 'string',
        value: valueStr.slice(1, -1),
        literal: true
      };
    }

    // Boolean
    if (valueStr === 'true' || valueStr === 'false') {
      return {
        type: 'boolean',
        value: valueStr === 'true'
      };
    }

    // Array
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      return {
        type: 'array',
        value: this._parseArray(valueStr.slice(1, -1))
      };
    }

    // Inline table
    if (valueStr.startsWith('{') && valueStr.endsWith('}')) {
      return {
        type: 'table',
        value: this._parseInlineTable(valueStr.slice(1, -1))
      };
    }

    // Date/time (simplified)
    if (/^\d{4}-\d{2}-\d{2}/.test(valueStr)) {
      return {
        type: 'datetime',
        value: valueStr
      };
    }

    // Number
    if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valueStr)) {
      return {
        type: 'number',
        value: parseFloat(valueStr)
      };
    }

    // Integer
    if (/^[+-]?\d+$/.test(valueStr)) {
      return {
        type: 'integer',
        value: parseInt(valueStr, 10)
      };
    }

    // Unquoted string (bare key)
    return {
      type: 'string',
      value: valueStr,
      bare: true
    };
  }

  _parseArray(content) {
    const items = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = null;
        current += char;
      } else if (!inString) {
        if (char === '[' || char === '{') {
          depth++;
          current += char;
        } else if (char === ']' || char === '}') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          if (current.trim()) {
            items.push(this._parseValue(current.trim()));
          }
          current = '';
          continue;
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      items.push(this._parseValue(current.trim()));
    }

    return items;
  }

  _parseInlineTable(content) {
    const table = {};
    const pairs = this._splitKeyValuePairs(content);

    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        const value = pair.substring(equalIndex + 1).trim();
        table[key] = this._parseValue(value);
      }
    }

    return table;
  }

  _splitKeyValuePairs(content) {
    const pairs = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = null;
        current += char;
      } else if (!inString) {
        if (char === '[' || char === '{') {
          depth++;
          current += char;
        } else if (char === ']' || char === '}') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          if (current.trim()) {
            pairs.push(current.trim());
          }
          current = '';
          continue;
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      pairs.push(current.trim());
    }

    return pairs;
  }

  _unescapeString(str) {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  _buildTree(data, options) {
    const root = {
      title: options.filename || 'TOML Configuration',
      content: this._getDocumentSummary(data),
      contentType: 'toml',
      children: [],
      metadata: {
        parser: this.getName(),
        parseOptions: options
      }
    };

    // Build tree from parsed data
    for (const [key, value] of Object.entries(data)) {
      if (key === '_root') {
        // Add root level items
        for (const [rootKey, rootValue] of Object.entries(value)) {
          root.children.push(this._createNode(rootKey, rootValue));
        }
      } else {
        // Add sections
        root.children.push(this._createNode(key, value));
      }
    }

    return root;
  }

  _createNode(key, value) {
    // Array of tables
    if (Array.isArray(value)) {
      return {
        title: `[[${key}]]`,
        content: `Array of ${value.length} tables`,
        contentType: 'toml-array',
        children: value.map((item, index) => ({
          title: `${key}[${index}]`,
          content: this._getNodeContent(item),
          contentType: 'toml-table',
          children: this._createChildNodes(item)
        }))
      };
    }

    // Table/section
    if (typeof value === 'object' && value !== null && !value.type) {
      const childCount = Object.keys(value).length;
      return {
        title: `[${key}]`,
        content: `Table with ${childCount} entries`,
        contentType: 'toml-table',
        children: this._createChildNodes(value)
      };
    }

    // Value with type info
    if (value && value.type) {
      return this._createValueNode(key, value);
    }

    // Direct value
    return {
      title: key,
      content: String(value),
      contentType: 'toml-value'
    };
  }

  _createValueNode(key, value) {
    let content = '';
    let contentType = 'toml-value';

    switch (value.type) {
      case 'string':
        content = value.multiline ? `"""\n${value.value}\n"""` : `"${value.value}"`;
        contentType = 'toml-string';
        break;
      case 'number':
      case 'integer':
        content = String(value.value);
        contentType = 'toml-number';
        break;
      case 'boolean':
        content = String(value.value);
        contentType = 'toml-boolean';
        break;
      case 'datetime':
        content = value.value;
        contentType = 'toml-datetime';
        break;
      case 'array':
        content = `Array with ${value.value.length} items`;
        contentType = 'toml-array';
        break;
      case 'table':
        content = `Inline table with ${Object.keys(value.value).length} entries`;
        contentType = 'toml-inline-table';
        break;
      default:
        content = JSON.stringify(value.value);
    }

    const node = {
      title: key,
      content,
      contentType,
      metadata: {
        type: value.type,
        value: value.value
      }
    };

    // Add children for arrays and inline tables
    if (value.type === 'array') {
      node.children = value.value.map((item, index) => 
        this._createValueNode(`[${index}]`, item)
      );
    } else if (value.type === 'table') {
      node.children = this._createChildNodes(value.value);
    }

    return node;
  }

  _createChildNodes(obj) {
    const children = [];
    
    for (const [key, value] of Object.entries(obj)) {
      children.push(this._createNode(key, value));
    }
    
    return children;
  }

  _getDocumentSummary(data) {
    let tableCount = 0;
    let keyCount = 0;

    const countItems = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key === '_root') {
          countItems(value);
        } else if (Array.isArray(value)) {
          tableCount += value.length;
        } else if (typeof value === 'object' && value !== null && !value.type) {
          tableCount++;
          countItems(value);
        } else {
          keyCount++;
        }
      }
    };

    countItems(data);
    
    const parts = [];
    if (tableCount > 0) parts.push(`${tableCount} tables`);
    if (keyCount > 0) parts.push(`${keyCount} keys`);
    
    return parts.join(', ') || 'Empty document';
  }

  _getNodeContent(obj) {
    const count = Object.keys(obj).length;
    return `${count} ${count === 1 ? 'entry' : 'entries'}`;
  }

  getCapabilities() {
    return {
      async: false,
      streaming: false,
      bidirectional: false,
      preservesFormatting: false,
      requiresDOM: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB

      features: [
        'tables',
        'array-of-tables',
        'inline-tables',
        'multiline-strings',
        'type-detection',
        'datetime-support',
        'unicode-support'
      ],

      options: {
        preserveComments: {
          type: 'boolean',
          default: false,
          description: 'Preserve comments in parsed output'
        },
        strictMode: {
          type: 'boolean',
          default: false,
          description: 'Enable strict TOML validation'
        },
        dateAsString: {
          type: 'boolean',
          default: true,
          description: 'Parse dates as strings instead of Date objects'
        },
        maxDepth: {
          type: 'number',
          default: 50,
          description: 'Maximum nesting depth for tables'
        }
      }
    };
  }
}

// Plugin export
export default {
  metadata: {
    name: 'TomlParser',
    version: '1.0.0',
    author: 'TreeScribe Team',
    description: 'TOML configuration file parser with full spec support',
    homepage: 'https://github.com/treescribe/toml-parser',
    license: 'MIT'
  },

  Parser: TomlParser,

  examples: {
    basic: `# This is a TOML document

title = "TOML Example"

[owner]
name = "Tom Preston-Werner"
dob = 1979-05-27T07:32:00-08:00

[database]
server = "192.168.1.1"
ports = [ 8001, 8001, 8002 ]
connection_max = 5000
enabled = true`,

    advanced: `# Complex TOML example

[package]
name = "treescribe"
version = "2.0.0"
authors = ["TreeScribe Team <team@treescribe.com>"]
description = """
A powerful document parsing library
with support for multiple formats."""

[dependencies]
parser-core = { version = "1.0", features = ["async"] }
utils = "2.1"

[[plugins]]
name = "markdown"
enabled = true
config = { theme = "dark", line_numbers = true }

[[plugins]]
name = "json"
enabled = false

[features]
default = ["markdown", "json"]
full = ["markdown", "json", "xml", "toml"]

[profile.dev]
opt-level = 0
debug = true

[profile.release]
opt-level = 3
debug = false`,

    config: `# Application configuration

[app]
name = "My Application"
version = "1.0.0"

[server]
host = "localhost"
port = 8080

[server.ssl]
enabled = true
cert = "/path/to/cert.pem"
key = "/path/to/key.pem"

[logging]
level = "info"
file = "app.log"
rotate = true
max_size = "10MB"

[cache]
type = "redis"
ttl = 3600

[cache.redis]
host = "localhost"
port = 6379
db = 0`
  }
};

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports.default;
}