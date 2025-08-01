# TreeScribe Parser Plugin Architecture

## Overview

The TreeScribe plugin system allows developers to create custom parsers for additional document formats while maintaining security, performance, and consistency with the core parser API.

## Plugin Structure

### Plugin Interface

Every plugin must implement the BaseParser interface and export a specific structure:

```javascript
export default {
  // Plugin metadata
  metadata: {
    name: 'MyFormatParser',
    version: '1.0.0',
    author: 'Plugin Author',
    description: 'Parser for MyFormat documents',
    homepage: 'https://example.com/myformat-parser'
  },
  
  // Parser class that extends BaseParser
  Parser: class MyFormatParser extends BaseParser {
    // Implementation
  },
  
  // Optional: Configuration schema
  configSchema: {
    // JSON Schema for plugin configuration
  },
  
  // Optional: Dependencies
  dependencies: {
    // External dependencies if needed
  }
};
```

## Security Model

### Sandboxed Execution

Plugins run in a restricted environment with:

1. **No direct file system access** - Plugins receive content as strings
2. **No network access** - Plugins cannot make external requests
3. **Limited global access** - Only approved globals are available
4. **Resource limits** - CPU and memory usage are monitored
5. **No eval/Function constructor** - Dynamic code execution is blocked

### Capability-Based Security

Plugins must declare required capabilities:

```javascript
capabilities: {
  regex: true,          // Can use regular expressions
  unicode: true,        // Can process unicode
  largeFiles: false,    // Cannot process files > 10MB
  async: false,         // Synchronous only
  customRenderers: []   // No custom renderers
}
```

## Plugin Lifecycle

### 1. Registration

```javascript
pluginManager.register('myformat', pluginModule);
```

### 2. Validation

- Metadata validation
- Interface compliance check
- Security audit
- Performance baseline

### 3. Initialization

- Create sandboxed context
- Inject approved globals
- Set resource limits
- Initialize parser instance

### 4. Execution

- Content passed to parser
- Monitor resource usage
- Capture errors/warnings
- Return normalized result

### 5. Cleanup

- Clear sandbox
- Release resources
- Log metrics

## API Contract

### Required Methods

```javascript
class CustomParser extends BaseParser {
  getName() { /* required */ }
  getSupportedFormats() { /* required */ }
  canParse(content, hints) { /* required */ }
  parse(content, options) { /* required */ }
  validate(content) { /* required */ }
}
```

### Plugin Hooks

```javascript
{
  // Called before parsing
  beforeParse: (content, options) => {
    // Pre-processing
    return { content, options };
  },
  
  // Called after parsing
  afterParse: (result, content, options) => {
    // Post-processing
    return result;
  },
  
  // Called on error
  onError: (error, content, options) => {
    // Error handling
    return { handled: false, recovery: null };
  }
}
```

## Resource Management

### Limits

- **Parse time**: 5 seconds max
- **Memory**: 50MB allocation limit
- **Result size**: 10MB max
- **Node count**: 50,000 max
- **Depth**: 100 levels max

### Monitoring

```javascript
const metrics = {
  parseTime: 0,
  memoryUsed: 0,
  nodesCreated: 0,
  errors: [],
  warnings: []
};
```

## Plugin Development

### Template Structure

```
my-parser-plugin/
├── package.json
├── README.md
├── src/
│   ├── index.js      # Plugin entry point
│   ├── parser.js     # Parser implementation
│   └── utils.js      # Helper functions
├── test/
│   └── parser.test.js
└── examples/
    └── sample.myformat
```

### Development Workflow

1. Clone plugin template
2. Implement parser class
3. Write comprehensive tests
4. Test in sandbox environment
5. Submit for review
6. Publish to registry

## Plugin Registry

### Official Registry

- Curated plugins
- Security reviewed
- Performance tested
- Version management
- Update notifications

### Local Plugins

```javascript
// Load from file
pluginManager.loadLocal('./my-parser.js');

// Load from URL (development only)
pluginManager.loadUrl('http://localhost:3000/my-parser.js');
```

## Error Handling

### Plugin Errors

```javascript
class PluginError extends Error {
  constructor(message, plugin, details) {
    super(message);
    this.plugin = plugin;
    this.details = details;
  }
}
```

### Recovery Strategies

1. **Graceful degradation** - Use fallback parser
2. **Partial results** - Return what was parsed
3. **Error reporting** - Clear user feedback
4. **Rollback** - Revert to previous state

## Performance Considerations

### Optimization Guidelines

1. **Lazy evaluation** - Parse on demand
2. **Streaming** - Process in chunks if possible
3. **Caching** - Cache repeated patterns
4. **Early exit** - Fail fast on invalid input

### Benchmarking

```javascript
// Built-in benchmarking
const benchmark = await pluginManager.benchmark(plugin, testData);
console.log(benchmark.averageTime);
console.log(benchmark.memoryPeak);
```

## Example Plugin

```javascript
// csv-parser-plugin.js
export default {
  metadata: {
    name: 'CsvParser',
    version: '1.0.0',
    author: 'TreeScribe Team',
    description: 'CSV file parser with hierarchy detection'
  },
  
  Parser: class CsvParser extends BaseParser {
    getName() { return 'CsvParser'; }
    
    getSupportedFormats() { return ['csv', 'tsv']; }
    
    canParse(content, hints = {}) {
      if (hints.format === 'csv') return 1.0;
      // Check for CSV patterns
      const lines = content.split('\n').slice(0, 5);
      const hasCommas = lines.every(l => l.includes(','));
      return hasCommas ? 0.8 : 0;
    }
    
    parse(content, options = {}) {
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      return {
        title: 'CSV Document',
        content: `${headers.length} columns, ${lines.length - 1} rows`,
        children: this._parseRows(lines.slice(1), headers),
        sourceFormat: 'csv'
      };
    }
    
    _parseRows(lines, headers) {
      return lines.map((line, index) => {
        const values = line.split(',');
        return {
          title: `Row ${index + 1}`,
          content: line,
          children: headers.map((header, i) => ({
            title: header,
            content: values[i] || '',
            contentType: 'text'
          }))
        };
      });
    }
  }
};
```

## Testing Plugins

### Unit Tests

```javascript
describe('MyFormatParser', () => {
  test('parses valid content', () => {
    const parser = new MyFormatParser();
    const result = parser.parse(validContent);
    expect(result.title).toBeDefined();
  });
});
```

### Integration Tests

```javascript
test('plugin loads in manager', async () => {
  const manager = new PluginManager();
  await manager.register('myformat', plugin);
  
  const parser = manager.getParser('myformat');
  expect(parser).toBeDefined();
});
```

### Security Tests

```javascript
test('plugin respects sandbox', async () => {
  const maliciousPlugin = createMaliciousPlugin();
  
  await expect(
    manager.register('bad', maliciousPlugin)
  ).rejects.toThrow('Security violation');
});
```