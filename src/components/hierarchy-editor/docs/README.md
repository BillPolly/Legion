# HierarchyEditor Documentation

## Overview

HierarchyEditor is a powerful, multi-format editable hierarchy display component that follows the Umbilical Component Protocol. It supports viewing and editing structured data in JSON, XML, YAML, and Markdown formats with features like tree/source view modes, inline editing, syntax highlighting, and real-time synchronization.

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Examples](#examples)
8. [Testing](#testing)
9. [Development](#development)

## Features

- **Multi-Format Support**: JSON, XML, YAML, and Markdown
- **Dual View Modes**: Tree view for structure, source view for raw editing
- **Inline Editing**: Direct value modification in tree view
- **Syntax Highlighting**: Format-specific highlighting in source view
- **Real-Time Sync**: Changes synchronized between views
- **Validation**: Built-in and custom validators
- **Event System**: Comprehensive event callbacks
- **Error Handling**: Graceful error recovery
- **Accessibility**: ARIA support and keyboard navigation
- **Themes**: Light and dark themes
- **Extensible**: Plugin system for custom functionality

## Installation

### As ES6 Module

```javascript
import { HierarchyEditor } from './src/components/hierarchy-editor/index.js';
```

### In HTML

```html
<script type="module">
  import { HierarchyEditor } from './src/components/hierarchy-editor/index.js';
  
  // Use HierarchyEditor
</script>
```

## Quick Start

```javascript
// Create container
const container = document.getElementById('editor-container');

// Create editor instance
const editor = HierarchyEditor.create({
  dom: container,
  content: '{"hello": "world", "count": 42}',
  format: 'json',
  theme: 'light',
  editable: true,
  
  // Optional callbacks
  onChange: (event) => {
    console.log('Content changed:', event.content);
  },
  onError: (error) => {
    console.error('Error:', error.message);
  }
});

// Render the editor
editor.render();

// Use the API
editor.expandAll();
editor.editNode('count', 100);
console.log(editor.getContent()); // {"hello": "world", "count": 100}
```

## Architecture

HierarchyEditor follows the MVVM (Model-View-ViewModel) pattern with clean separation of concerns:

### Components

1. **Model Layer** (`model/`)
   - `HierarchyModel`: Core data model
   - `HierarchyNode`: Node representation
   - Handles data parsing, validation, and state

2. **View Layer** (`view/`)
   - `HierarchyTreeView`: Tree rendering
   - `SourceView`: Source code editor
   - `SyntaxHighlighter`: Syntax highlighting
   - `ViewModeManager`: Mode switching
   - `NodeViewMapping`: Incremental updates

3. **ViewModel Layer** (`viewmodel/`)
   - `HierarchyViewModel`: Coordinates model and view
   - `EditingManager`: Handles edit operations
   - `ValidationManager`: Manages validation

4. **Format Handlers** (`handlers/`)
   - `JsonHandler`: JSON parsing/serialization
   - `XmlHandler`: XML parsing/serialization
   - `YamlHandler`: YAML parsing/serialization
   - `MarkdownHandler`: Markdown parsing/serialization

### Umbilical Protocol

The component follows the three-mode Umbilical Component Protocol:

```javascript
// 1. Introspection mode
HierarchyEditor.create({
  describe: (requirements) => {
    // Component describes what it needs
  }
});

// 2. Validation mode
HierarchyEditor.create({
  validate: (checks) => {
    // Component validates umbilical
  }
});

// 3. Instance mode
const editor = HierarchyEditor.create({
  dom: container,
  // ... configuration
});
```

## API Reference

### Core Methods

#### `render()`
Initializes and renders the component.
```javascript
editor.render();
```

#### `destroy()`
Cleans up and destroys the component.
```javascript
editor.destroy();
```

#### `getContent()`
Returns the current content as a string.
```javascript
const content = editor.getContent();
```

#### `setContent(content)`
Updates the entire content.
```javascript
editor.setContent('{"new": "data"}');
```

#### `loadContent(content, format?)`
Loads content with optional format specification.
```javascript
editor.loadContent('<root><item>value</item></root>', 'xml');
```

### View Mode Methods

#### `setMode(mode)`
Switches between 'tree' and 'source' modes.
```javascript
await editor.setMode('source');
```

#### `getMode()`
Returns the current view mode.
```javascript
const mode = editor.getMode(); // 'tree' or 'source'
```

### Node Operations

#### `selectNode(pathOrId)`
Selects a node by path or ID.
```javascript
editor.selectNode('user.name');
editor.selectNode('node-123');
```

#### `expandNode(pathOrId, recursive?)`
Expands a node, optionally recursively.
```javascript
editor.expandNode('user', true);
```

#### `collapseNode(pathOrId)`
Collapses a node.
```javascript
editor.collapseNode('user');
```

#### `expandAll()` / `collapseAll()`
Expands or collapses all nodes.
```javascript
editor.expandAll();
editor.collapseAll();
```

### Edit Operations

#### `editNode(pathOrId, value)`
Updates a node's value.
```javascript
editor.editNode('user.age', 25);
```

#### `addNode(parentPath, value, key?)`
Adds a new node.
```javascript
editor.addNode('items', 'new item');        // Add to array
editor.addNode('user', 'value', 'newKey');  // Add to object
```

#### `deleteNode(pathOrId)`
Removes a node.
```javascript
editor.deleteNode('temp.data');
```

#### `moveNode(fromPath, toPath, toIndex)`
Moves a node to a new location.
```javascript
editor.moveNode('items.0', 'archived', 0);
```

### Event Methods

#### `on(event, handler)`
Adds an event listener.
```javascript
editor.on('change', (data) => console.log(data));
```

#### `off(event, handler)`
Removes an event listener.
```javascript
editor.off('change', myHandler);
```

#### `emit(event, data)`
Emits a custom event.
```javascript
editor.emit('customEvent', { custom: 'data' });
```

### Utility Methods

#### `getTreeData()`
Returns the hierarchical data structure.
```javascript
const tree = editor.getTreeData();
```

#### `validate(content?, format?)`
Validates content.
```javascript
const result = editor.validate('{"test": true}');
if (result.valid) {
  console.log('Valid!');
}
```

#### `bulkOperation(operation)`
Performs multiple operations as a single change.
```javascript
editor.bulkOperation(() => {
  editor.addNode('items', 'item1');
  editor.addNode('items', 'item2');
  editor.editNode('count', 2);
});
```

## Configuration

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dom` | HTMLElement | required | Container element |
| `content` | string | `''` | Initial content |
| `format` | string | `'json'` | Format: 'json', 'xml', 'yaml', 'markdown' |
| `editable` | boolean | `true` | Enable editing |
| `showToolbar` | boolean | `true` | Show mode toggle toolbar |
| `defaultMode` | string | `'tree'` | Initial view mode |
| `theme` | string | `'light'` | Theme: 'light' or 'dark' |

### Styling Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indentSize` | number | `20` | Tree indent in pixels |
| `indentChar` | string | `'  '` | Source indent character |
| `icons` | object | default icons | Custom node icons |
| `highContrast` | boolean | `false` | High contrast mode |

### Behavior Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validators` | object | `{}` | Custom validators |
| `requiredPaths` | array | `[]` | Paths that cannot be deleted |
| `enableKeyboardShortcuts` | boolean | `true` | Enable shortcuts |
| `shortcuts` | object | defaults | Custom keyboard shortcuts |

### Event Callbacks

```javascript
{
  // Lifecycle
  onMount: (event) => {},
  onDestroy: (event) => {},
  onReady: (event) => {},
  
  // Content changes
  onChange: (event) => {},
  onContentChange: (event) => {},
  onBeforeChange: (event) => {},
  
  // Edit operations
  onNodeEdit: (event) => {},
  onNodeAdd: (event) => {},
  onNodeRemove: (event) => {},
  onNodeMove: (event) => {},
  
  // Navigation
  onSelect: (event) => {},
  onExpand: (event) => {},
  onCollapse: (event) => {},
  
  // Validation
  onValidation: (event) => {},
  onValidationError: (event) => {},
  
  // Errors
  onError: (error) => {},
  onRecovery: (event) => {}
}
```

## Examples

### Custom Validators

```javascript
const editor = HierarchyEditor.create({
  dom: container,
  content: '{"age": 25, "email": "test@example.com"}',
  validators: {
    age: (value) => {
      if (typeof value !== 'number' || value < 0 || value > 150) {
        return { valid: false, error: 'Age must be 0-150' };
      }
      return { valid: true };
    },
    email: (value) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regex.test(value)) {
        return { valid: false, error: 'Invalid email' };
      }
      return { valid: true };
    }
  }
});
```

### Multi-Format Handling

```javascript
// Auto-detect format
editor.loadContent(someContent);

// Explicit format
editor.loadContent(xmlString, 'xml');

// Convert between formats
const json = editor.getContent();
editor.loadContent(json, 'yaml');
const yaml = editor.getContent();
```

### Event Handling

```javascript
const editor = HierarchyEditor.create({
  dom: container,
  content: data,
  
  onChange: ({ content, source }) => {
    console.log(`Changed via ${source}:`, content);
  },
  
  onNodeEdit: ({ path, oldValue, newValue }) => {
    console.log(`${path}: ${oldValue} → ${newValue}`);
  },
  
  onError: ({ type, message, recoverable }) => {
    if (recoverable) {
      console.warn(`Recoverable error: ${message}`);
    } else {
      console.error(`Fatal error: ${message}`);
    }
  }
});
```

### Bulk Operations

```javascript
// Perform multiple changes as one
editor.bulkOperation(() => {
  // Add 100 items
  for (let i = 0; i < 100; i++) {
    editor.addNode('items', {
      id: i,
      name: `Item ${i}`,
      value: Math.random()
    });
  }
  
  // Update metadata
  editor.editNode('metadata.count', 100);
  editor.editNode('metadata.lastUpdate', new Date().toISOString());
});
// Only one change event emitted
```

### Custom Theme

```css
/* Custom theme styles */
.hierarchy-editor.theme-custom {
  --he-background: #2d2d2d;
  --he-text: #ffffff;
  --he-border: #444444;
  --he-selection: #4a90e2;
  --he-hover: #3a3a3a;
}

.theme-custom .node-name {
  color: #61dafb;
}

.theme-custom .node-value {
  color: #ffd700;
}
```

```javascript
editor.setTheme('custom');
```

## Testing

See [Testing Guide](testing-guide.md) for comprehensive testing documentation.

### Quick Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific suite
npm test -- --testPathPattern="hierarchy-editor"

# Run in watch mode
npm run test:watch
```

## Development

### Building

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start dev server
npm start
```

### Project Structure

```
hierarchy-editor/
├── index.js                 # Main entry point
├── HierarchyEditorInstance.js
├── EventEmitter.js
├── model/                   # Data model layer
├── view/                    # View components
├── viewmodel/              # Coordination layer
├── handlers/               # Format handlers
├── test/                   # Test suites
└── docs/                   # Documentation
```

### Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Ensure all tests pass
5. Maintain >90% code coverage

### Design Principles

- **Umbilical Protocol**: All external dependencies through single parameter
- **MVVM Architecture**: Clear separation of concerns
- **Event-Driven**: Loose coupling through events
- **Incremental Updates**: Efficient DOM updates
- **Format Agnostic**: Unified interface for all formats
- **Error Resilient**: Graceful error handling and recovery

## License

This component is part of the Umbilical Component Protocol project.