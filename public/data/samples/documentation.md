# Project Documentation

## Overview

This is a comprehensive guide for our project, demonstrating the Markdown format capabilities of the HierarchyEditor component.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [API Reference](#api-reference)
5. [Examples](#examples)
6. [Troubleshooting](#troubleshooting)

## Getting Started

Welcome to our project! This documentation will help you understand how to use and contribute to the codebase.

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v16 or higher)
- npm or yarn
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/example/project.git

# Install dependencies
npm install

# Run the development server
npm run dev
```

## Installation

### Using npm

```bash
npm install @example/hierarchy-editor
```

### Using yarn

```bash
yarn add @example/hierarchy-editor
```

### Manual Installation

1. Download the latest release from [GitHub](https://github.com/example/project/releases)
2. Extract the files to your project directory
3. Include the required scripts in your HTML

## Configuration

### Basic Configuration

```javascript
const config = {
  theme: 'light',
  language: 'en',
  features: {
    editing: true,
    validation: true,
    autoSave: false
  }
};
```

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | string | 'light' | Color theme ('light' or 'dark') |
| `language` | string | 'en' | Interface language |
| `readOnly` | boolean | false | Disable editing |
| `showToolbar` | boolean | true | Show/hide toolbar |

## API Reference

### Methods

#### `loadContent(content, format)`

Loads content into the editor.

**Parameters:**
- `content` (string): The content to load
- `format` (string): Content format ('json', 'xml', 'yaml', 'markdown')

**Example:**
```javascript
editor.loadContent(jsonString, 'json');
```

#### `getContent()`

Returns the current content as a string.

**Returns:** string

#### `setMode(mode)`

Switches between tree and source view modes.

**Parameters:**
- `mode` (string): Either 'tree' or 'source'

### Events

The editor emits various events you can listen to:

- `change`: Content has been modified
- `nodeEdit`: A node has been edited
- `nodeAdd`: A new node has been added
- `nodeRemove`: A node has been removed

## Examples

### Basic Example

```javascript
const editor = HierarchyEditor.create({
  dom: document.getElementById('editor'),
  content: '{"hello": "world"}',
  format: 'json'
});

editor.render();
```

### With Event Handlers

```javascript
const editor = HierarchyEditor.create({
  dom: document.getElementById('editor'),
  onChange: (event) => {
    console.log('Content changed:', event.content);
  },
  onNodeEdit: (event) => {
    console.log('Node edited:', event.path, event.newValue);
  }
});
```

## Troubleshooting

### Common Issues

#### Editor not rendering

**Problem:** The editor appears blank or doesn't initialize.

**Solution:**
1. Check that the DOM element exists
2. Ensure the script is loaded after the DOM is ready
3. Verify there are no JavaScript errors in the console

#### Content not loading

**Problem:** Content doesn't appear when calling `loadContent()`.

**Solution:**
1. Verify the content format matches the specified format
2. Check for parsing errors in the content
3. Ensure the content is a valid string

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/example/project/issues)
2. Join our [Discord community](https://discord.gg/example)
3. Email support at support@example.com

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.