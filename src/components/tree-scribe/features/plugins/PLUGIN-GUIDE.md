# TreeScribe Parser Plugin Development Guide

## Introduction

This guide will help you create custom parser plugins for TreeScribe. Parser plugins allow you to add support for new document formats while maintaining compatibility with TreeScribe's unified interface.

## Quick Start

1. **Copy the template**
   ```bash
   cp template/parser-plugin-template.js my-parser.js
   ```

2. **Replace placeholders**
   - Replace `MyFormat` with your format name
   - Update metadata with your information
   - Implement parsing logic

3. **Test your plugin**
   ```javascript
   import MyParser from './my-parser.js';
   const parser = new MyParser.Parser();
   const result = parser.parse(content);
   ```

## Plugin Structure

### Required Components

#### 1. Metadata Object
```javascript
metadata: {
  name: 'YourParserName',        // Required: Display name
  version: '1.0.0',              // Required: Semantic version
  author: 'Your Name',           // Required: Author name
  description: 'Parser for...',  // Required: Brief description
  homepage: 'https://...',       // Optional: Project URL
  license: 'MIT'                 // Optional: License
}
```

#### 2. Parser Class
Your parser must extend `BaseParser` and implement:

```javascript
class YourParser extends BaseParser {
  getName()                      // Return parser name
  getSupportedFormats()          // Return supported formats
  canParse(content, hints)       // Return confidence (0-1)
  parse(content, options)        // Parse and return tree
  validate(content)              // Validate content
}
```

### Optional Components

#### Configuration Schema
Define configurable options using JSON Schema:

```javascript
configSchema: {
  type: 'object',
  properties: {
    strictMode: {
      type: 'boolean',
      default: false,
      description: 'Enable strict parsing'
    }
  }
}
```

#### Examples
Provide example content for testing:

```javascript
examples: {
  basic: 'Your format example content',
  advanced: 'More complex example'
}
```

## Implementation Guide

### 1. Format Detection (`canParse`)

The `canParse` method should return a confidence score (0-1):

```javascript
canParse(content, hints = {}) {
  // Check hints first (fastest)
  if (hints.format === 'yourformat') return 1.0;
  
  // Check content patterns
  let confidence = 0;
  
  if (content.startsWith('MAGIC_HEADER')) {
    confidence += 0.5;
  }
  
  if (/pattern/.test(content)) {
    confidence += 0.3;
  }
  
  return Math.min(confidence, 0.95);
}
```

**Best Practices:**
- Return 1.0 only for explicit format hints
- Cap content-based detection at 0.95
- Check distinctive patterns first
- Fail fast for non-matching content

### 2. Content Validation

Validate before parsing to provide clear error messages:

```javascript
validate(content) {
  const errors = [];
  
  if (!content || typeof content !== 'string') {
    errors.push('Content must be a string');
  }
  
  if (content && !this._hasRequiredStructure(content)) {
    errors.push('Missing required structure');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 3. Parsing Implementation

Break parsing into logical steps:

```javascript
parse(content, options = {}) {
  try {
    // 1. Validate
    const validation = this.validate(content);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
    
    // 2. Parse format
    const parsed = this._parseFormat(content);
    
    // 3. Build tree
    const tree = this._buildTree(parsed, options);
    
    // 4. Normalize
    const normalized = this._normalizeNode(tree);
    normalized.sourceFormat = 'yourformat';
    
    return normalized;
    
  } catch (error) {
    return this._createErrorNode(error);
  }
}
```

### 4. Tree Structure

TreeScribe expects a specific node structure:

```javascript
{
  title: 'Node Title',           // Required: Display title
  content: 'Node content',       // Optional: Node content
  contentType: 'text',          // Optional: Content type
  children: [],                 // Required: Child nodes array
  metadata: {},                 // Optional: Additional data
  sourceFormat: 'yourformat'    // Set by parser
}
```

**Content Types:**
- `text` - Plain text
- `markdown` - Markdown formatted
- `code` - Code content
- `html` - HTML content
- `error` - Error message
- Custom types supported

### 5. Error Handling

Always return a valid tree, even on error:

```javascript
_createErrorNode(error) {
  return this._normalizeNode({
    title: 'Parse Error',
    content: error.message,
    contentType: 'error',
    children: [],
    metadata: {
      error: true,
      errorMessage: error.message,
      parser: this.getName()
    }
  });
}
```

## Security Considerations

Plugins run in a sandboxed environment with restrictions:

### Allowed
- ✅ String manipulation
- ✅ Regular expressions
- ✅ Basic JavaScript operations
- ✅ JSON parsing
- ✅ Math operations

### Not Allowed
- ❌ File system access
- ❌ Network requests
- ❌ eval() or new Function()
- ❌ DOM manipulation
- ❌ Global modifications

### Resource Limits
- Parse time: 5 seconds maximum
- Memory: 50MB allocation limit
- Result size: 10MB maximum
- Node count: 50,000 maximum
- Depth: 100 levels maximum

## Testing Your Plugin

### Unit Tests

Test each method independently:

```javascript
describe('YourParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new YourParser();
  });
  
  test('detects format correctly', () => {
    const content = 'YOUR_FORMAT_EXAMPLE';
    expect(parser.canParse(content)).toBeGreaterThan(0.8);
  });
  
  test('parses valid content', () => {
    const result = parser.parse(validContent);
    expect(result.title).toBeDefined();
    expect(result.children).toBeInstanceOf(Array);
  });
  
  test('handles invalid content', () => {
    const result = parser.parse('invalid');
    expect(result.metadata.error).toBe(true);
  });
});
```

### Integration Tests

Test with TreeScribe:

```javascript
import { ParserPluginManager } from 'treescribe';
import YourPlugin from './your-plugin.js';

test('plugin integrates correctly', async () => {
  const manager = new ParserPluginManager();
  await manager.register('yourformat', YourPlugin);
  
  const result = await manager.parse('yourformat', content);
  expect(result).toBeDefined();
});
```

### Performance Tests

Ensure your parser meets performance requirements:

```javascript
test('parses within time limit', async () => {
  const start = performance.now();
  parser.parse(largeDocument);
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(5000); // 5 seconds
});
```

## Common Patterns

### Hierarchical Formats

For formats with natural hierarchy:

```javascript
_buildHierarchy(items, level = 0) {
  const nodes = [];
  let i = 0;
  
  while (i < items.length) {
    const item = items[i];
    
    if (item.level === level) {
      const node = {
        title: item.title,
        content: item.content,
        children: []
      };
      
      // Collect children
      i++;
      const childItems = [];
      while (i < items.length && items[i].level > level) {
        childItems.push(items[i]);
        i++;
      }
      
      if (childItems.length > 0) {
        node.children = this._buildHierarchy(childItems, level + 1);
      }
      
      nodes.push(node);
    } else {
      i++;
    }
  }
  
  return nodes;
}
```

### Table/Grid Formats

For tabular data like CSV:

```javascript
_parseTable(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return {
    title: 'Table Data',
    content: `${headers.length} columns, ${lines.length - 1} rows`,
    children: lines.slice(1).map((line, index) => ({
      title: `Row ${index + 1}`,
      children: line.split(',').map((cell, i) => ({
        title: headers[i],
        content: cell.trim()
      }))
    }))
  };
}
```

### Key-Value Formats

For configuration-style formats:

```javascript
_parseKeyValue(content) {
  const root = {
    title: 'Configuration',
    children: []
  };
  
  const lines = content.split('\n');
  let currentSection = root;
  
  for (const line of lines) {
    if (line.startsWith('[') && line.endsWith(']')) {
      // New section
      currentSection = {
        title: line.slice(1, -1),
        children: []
      };
      root.children.push(currentSection);
    } else if (line.includes('=')) {
      // Key-value pair
      const [key, value] = line.split('=');
      currentSection.children.push({
        title: key.trim(),
        content: value.trim()
      });
    }
  }
  
  return root;
}
```

## Publishing Your Plugin

### 1. Package Structure

```
my-parser-plugin/
├── package.json
├── README.md
├── LICENSE
├── src/
│   └── index.js
├── test/
│   └── parser.test.js
└── examples/
    └── sample.myformat
```

### 2. Package.json

```json
{
  "name": "treescribe-myformat-parser",
  "version": "1.0.0",
  "description": "MyFormat parser for TreeScribe",
  "main": "src/index.js",
  "type": "module",
  "keywords": ["treescribe", "parser", "myformat"],
  "author": "Your Name",
  "license": "MIT",
  "peerDependencies": {
    "treescribe": "^2.0.0"
  }
}
```

### 3. Documentation

Include in your README:
- Format description
- Installation instructions
- Usage examples
- Configuration options
- Limitations

### 4. Submit to Registry

Coming soon: TreeScribe plugin registry for easy discovery and installation.

## Troubleshooting

### Common Issues

1. **Parser not detected**
   - Ensure `getSupportedFormats()` returns correct format strings
   - Check that plugin exports default object with Parser class

2. **Parse errors**
   - Always return a valid tree structure
   - Use try-catch and return error nodes
   - Validate content before parsing

3. **Performance issues**
   - Avoid excessive regex backtracking
   - Limit recursion depth
   - Use early exit strategies

4. **Memory issues**
   - Stream large files if possible
   - Limit node creation
   - Clear temporary data

### Debug Mode

Enable debug logging:

```javascript
parse(content, options = {}) {
  if (options.debug) {
    console.log('[YourParser] Starting parse...');
  }
  // ... parsing logic
}
```

## Support

- GitHub Issues: [TreeScribe Repository](https://github.com/treescribe/treescribe)
- Plugin Examples: `/examples/plugins/`
- Community Discord: Coming soon

## Conclusion

Creating TreeScribe parser plugins is straightforward:
1. Extend BaseParser
2. Implement required methods
3. Return proper tree structure
4. Handle errors gracefully
5. Test thoroughly

Happy parsing! 🌳