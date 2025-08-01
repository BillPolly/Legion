# HierarchyEditor Design Document

**Version**: 1.0  
**Status**: MVP Design  
**Created**: January 2025  

## Overview

HierarchyEditor is a multi-format, editable hierarchy display component that allows users to view and edit structured data in various formats (JSON, XML, YAML, Markdown) while maintaining both a tree view and native format representation. Unlike TreeScribe which is read-only, HierarchyEditor provides full editing capabilities with format-aware validation and real-time synchronization between views.

## Goals

### Primary Goals
1. **Multi-Format Support**: Parse, display, and edit JSON, XML, YAML, and Markdown files
2. **Native Format Display**: Show content in its actual format with syntax highlighting
3. **Bidirectional Editing**: Edit in tree view or source view with automatic synchronization
4. **Format Preservation**: Maintain format-specific features (comments, formatting, attributes)
5. **Intuitive Editing**: Provide inline editing, drag & drop, and structural operations

### MVP Scope
- Support for JSON, XML, YAML, and Markdown formats
- Tree view with expand/collapse functionality
- Source view with syntax highlighting
- Inline editing of values
- Add/remove nodes
- Basic validation
- Format switching

## Architecture

### Component Structure

```
HierarchyEditor/
├── index.js                    # Umbilical protocol entry point
├── model/
│   ├── HierarchyModel.js      # Core data model
│   ├── FormatHandler.js       # Abstract format handler
│   └── formats/
│       ├── JsonHandler.js     # JSON parsing/serialization
│       ├── XmlHandler.js      # XML parsing/serialization
│       ├── YamlHandler.js     # YAML parsing/serialization
│       └── MarkdownHandler.js # Markdown parsing/serialization
├── view/
│   ├── HierarchyView.js       # Main view controller
│   ├── TreeView.js            # Tree rendering
│   ├── SourceView.js          # Source code rendering
│   └── renderers/
│       ├── JsonRenderer.js    # JSON-specific rendering
│       ├── XmlRenderer.js     # XML-specific rendering
│       ├── YamlRenderer.js    # YAML-specific rendering
│       └── MarkdownRenderer.js # Markdown-specific rendering
└── viewmodel/
    ├── HierarchyViewModel.js  # Main coordination
    ├── EditingManager.js      # Edit operations
    └── ValidationManager.js   # Format validation
```

### Core Concepts

#### 1. Unified Data Model
The component uses a unified hierarchical data model that can represent any structured format:

```javascript
class HierarchyNode {
  constructor() {
    this.id = generateId();
    this.type = 'object'; // object, array, value, element, text
    this.name = '';       // Key name or element tag
    this.value = null;    // Primitive value
    this.children = [];   // Child nodes
    this.metadata = {};   // Format-specific data
    this.parent = null;   // Parent reference
  }
}
```

#### 2. Two-Way Mapping System
The component maintains an incremental two-way mapping between model nodes and view elements for efficient rendering and editing:

```javascript
class NodeViewMapping {
  constructor() {
    this.modelToView = new Map();  // nodeId -> DOM element
    this.viewToModel = new WeakMap(); // DOM element -> nodeId
    this.dirtyNodes = new Set();     // Nodes needing re-render
  }

  // Register a model-view pair
  register(nodeId, element) {
    this.modelToView.set(nodeId, element);
    this.viewToModel.set(element, nodeId);
  }

  // Mark node as dirty for incremental update
  markDirty(nodeId) {
    this.dirtyNodes.add(nodeId);
  }

  // Get only nodes that need updating
  getDirtyNodes() {
    return Array.from(this.dirtyNodes);
  }

  // Clear dirty state after render
  clearDirty() {
    this.dirtyNodes.clear();
  }
}
```

This mapping system enables:
- **Incremental Rendering**: Only update changed nodes instead of re-rendering entire tree
- **Direct Element Access**: Instantly locate DOM elements for editing without querying
- **Efficient Event Handling**: Map DOM events back to model nodes without traversal
- **Minimal DOM Manipulation**: Preserve unchanged elements during updates

#### 3. Format Handlers
Each format has a dedicated handler responsible for bidirectional conversion:

```javascript
class FormatHandler {
  // Parse source to hierarchy
  parse(source) { /* returns HierarchyNode */ }
  
  // Serialize hierarchy to source
  serialize(node) { /* returns string */ }
  
  // Validate source format
  validate(source) { /* returns { valid, errors } */ }
  
  // Get format metadata
  getMetadata() { /* returns { name, extensions, mimeType } */ }
}
```

#### 4. View Modes
The component supports multiple view modes:

- **Tree View**: Hierarchical node display with expand/collapse
- **Source View**: Native format with syntax highlighting
- **Split View**: Both views side-by-side (future enhancement)

### MVVM Implementation

#### Model Layer (HierarchyModel)
```javascript
class HierarchyModel extends BaseModel {
  constructor(config) {
    super();
    this.root = null;          // Root hierarchy node
    this.format = null;        // Current format
    this.source = '';          // Original source
    this.handlers = new Map(); // Format handlers
    this.isDirty = false;      // Modified flag
  }

  // Load content with format detection
  loadContent(content, format = null) {
    if (!format) {
      format = this.detectFormat(content);
    }
    
    const handler = this.handlers.get(format);
    this.root = handler.parse(content);
    this.source = content;
    this.format = format;
    this.isDirty = false;
    
    this.notify('contentLoaded', { root: this.root, format });
  }

  // Update node value
  updateNodeValue(nodeId, newValue) {
    const node = this.findNode(nodeId);
    if (node) {
      node.value = newValue;
      this.isDirty = true;
      this.notify('nodeUpdated', { node, oldValue: node.value });
      this.syncSource();
    }
  }

  // Add child node
  addNode(parentId, nodeData) {
    const parent = this.findNode(parentId);
    if (parent) {
      const newNode = new HierarchyNode();
      Object.assign(newNode, nodeData);
      newNode.parent = parent;
      parent.children.push(newNode);
      
      this.isDirty = true;
      this.notify('nodeAdded', { parent, node: newNode });
      this.syncSource();
    }
  }

  // Synchronize source from hierarchy
  syncSource() {
    const handler = this.handlers.get(this.format);
    this.source = handler.serialize(this.root);
    this.notify('sourceUpdated', { source: this.source });
  }
}
```

#### View Layer (HierarchyView)
```javascript
class HierarchyView extends BaseView {
  constructor(dom, config) {
    super();
    this.dom = dom;
    this.config = config;
    this.treeView = null;
    this.sourceView = null;
    this.currentMode = 'tree';
    this.nodeMapping = new NodeViewMapping(); // Two-way mapping
  }

  render() {
    this.dom.innerHTML = `
      <div class="hierarchy-editor">
        <div class="he-toolbar">
          <button class="he-mode-btn" data-mode="tree">Tree</button>
          <button class="he-mode-btn" data-mode="source">Source</button>
          <span class="he-format">Format: <span class="format-name"></span></span>
        </div>
        <div class="he-content">
          <div class="he-tree-view"></div>
          <div class="he-source-view" style="display:none;"></div>
        </div>
      </div>
    `;

    this.initializeViews();
    this.attachEventListeners();
  }

  initializeViews() {
    const hierarchyContainer = this.dom.querySelector('.he-tree-view');
    const sourceContainer = this.dom.querySelector('.he-source-view');
    
    this.hierarchyView = new HierarchyTreeView(hierarchyContainer, this.config, this.nodeMapping);
    this.sourceView = new SourceView(sourceContainer, this.config);
  }

  renderHierarchy(root, format) {
    this.hierarchyView.render(root, format);
    this.dom.querySelector('.format-name').textContent = format.toUpperCase();
  }

  renderSource(source, format) {
    this.sourceView.render(source, format);
  }

  // Incremental update - only re-render changed nodes
  updateNodes(nodeIds) {
    const dirtyElements = nodeIds.map(id => this.nodeMapping.modelToView.get(id));
    dirtyElements.forEach((element, index) => {
      if (element) {
        this.hierarchyView.updateNode(nodeIds[index], element);
      }
    });
  }
}
```

#### ViewModel Layer (HierarchyViewModel)
```javascript
class HierarchyViewModel extends BaseViewModel {
  constructor(model, view, config) {
    super(model, view);
    this.config = config;
    this.editingManager = new EditingManager(this);
    this.validationManager = new ValidationManager(this);
  }

  initialize() {
    // Model event handlers
    this.model.on('contentLoaded', (data) => {
      this.view.renderHierarchy(data.root, data.format);
      this.view.renderSource(this.model.source, data.format);
    });

    this.model.on('nodeUpdated', (data) => {
      // Mark node as dirty for incremental update
      this.view.nodeMapping.markDirty(data.node.id);
      this.scheduleIncrementalUpdate();
    });

    this.model.on('nodesAdded', (data) => {
      // Mark parent as dirty to re-render with new children
      data.nodes.forEach(node => {
        this.view.nodeMapping.markDirty(node.parent.id);
      });
      this.scheduleIncrementalUpdate();
    });

    this.model.on('sourceUpdated', (data) => {
      this.view.renderSource(data.source, this.model.format);
    });

    // View event handlers
    this.view.on('nodeEdit', (data) => {
      this.editingManager.startEdit(data.nodeId);
    });

    this.view.on('nodeValueChanged', (data) => {
      this.model.updateNodeValue(data.nodeId, data.value);
    });

    this.view.on('addNodeRequest', (data) => {
      this.showAddNodeDialog(data.parentId);
    });

    this.view.on('modeChanged', (data) => {
      this.view.setMode(data.mode);
    });
  }

  // Batch incremental updates for efficiency
  scheduleIncrementalUpdate() {
    if (this.updateTimer) return;
    
    this.updateTimer = requestAnimationFrame(() => {
      const dirtyNodes = this.view.nodeMapping.getDirtyNodes();
      this.view.updateNodes(dirtyNodes);
      this.view.nodeMapping.clearDirty();
      this.updateTimer = null;
    });
  }
}
```

### Format-Specific Implementation

#### JSON Handler
```javascript
class JsonHandler extends FormatHandler {
  parse(source) {
    try {
      const data = JSON.parse(source);
      return this.convertToHierarchy(data);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  convertToHierarchy(data, name = 'root') {
    const node = new HierarchyNode();
    node.name = name;

    if (data === null) {
      node.type = 'value';
      node.value = null;
    } else if (Array.isArray(data)) {
      node.type = 'array';
      data.forEach((item, index) => {
        node.children.push(this.convertToHierarchy(item, `[${index}]`));
      });
    } else if (typeof data === 'object') {
      node.type = 'object';
      Object.entries(data).forEach(([key, value]) => {
        node.children.push(this.convertToHierarchy(value, key));
      });
    } else {
      node.type = 'value';
      node.value = data;
    }

    return node;
  }

  serialize(node) {
    const data = this.convertFromHierarchy(node);
    return JSON.stringify(data, null, 2);
  }

  convertFromHierarchy(node) {
    switch (node.type) {
      case 'array':
        return node.children.map(child => this.convertFromHierarchy(child));
      case 'object':
        const obj = {};
        node.children.forEach(child => {
          obj[child.name] = this.convertFromHierarchy(child);
        });
        return obj;
      case 'value':
        return node.value;
    }
  }
}
```

#### XML Handler
```javascript
class XmlHandler extends FormatHandler {
  parse(source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/xml');
    
    if (doc.querySelector('parsererror')) {
      throw new Error('Invalid XML format');
    }
    
    return this.convertElementToHierarchy(doc.documentElement);
  }

  convertElementToHierarchy(element) {
    const node = new HierarchyNode();
    node.type = 'element';
    node.name = element.tagName;
    
    // Store attributes
    if (element.attributes.length > 0) {
      node.metadata.attributes = {};
      Array.from(element.attributes).forEach(attr => {
        node.metadata.attributes[attr.name] = attr.value;
      });
    }
    
    // Process children
    Array.from(element.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        node.children.push(this.convertElementToHierarchy(child));
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) {
          const textNode = new HierarchyNode();
          textNode.type = 'text';
          textNode.value = text;
          node.children.push(textNode);
        }
      }
    });
    
    return node;
  }

  serialize(node) {
    const doc = document.implementation.createDocument(null, null, null);
    const element = this.convertHierarchyToElement(node, doc);
    doc.appendChild(element);
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }
}
```

### Incremental Rendering with Two-Way Mapping

The two-way mapping system is central to HierarchyEditor's efficiency. Here's how it enables incremental updates:

```javascript
class HierarchyTreeView {
  constructor(dom, config, nodeMapping) {
    this.dom = dom;
    this.config = config;
    this.nodeMapping = nodeMapping; // Shared mapping instance
  }

  // Initial render - builds mapping
  render(root, format) {
    this.dom.innerHTML = '';
    this.renderNode(root, this.dom, 0);
  }

  renderNode(node, container, depth) {
    const element = document.createElement('div');
    element.className = 'he-node';
    element.setAttribute('data-node-id', node.id);
    
    // Register in two-way mapping
    this.nodeMapping.register(node.id, element);
    
    // Render node content
    element.innerHTML = this.buildNodeHTML(node, depth);
    container.appendChild(element);
    
    // Render children
    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'he-children';
      element.appendChild(childrenContainer);
      
      node.children.forEach(child => {
        this.renderNode(child, childrenContainer, depth + 1);
      });
    }
  }

  // Incremental update - only updates specific node
  updateNode(nodeId, element) {
    const node = this.findNodeById(nodeId);
    if (!node || !element) return;
    
    // Preserve children container
    const childrenContainer = element.querySelector('.he-children');
    
    // Update only the node's content
    const content = this.buildNodeHTML(node, this.getNodeDepth(element));
    element.innerHTML = content;
    
    // Restore children container
    if (childrenContainer) {
      element.appendChild(childrenContainer);
    }
  }
}
```

### Editing Features

#### Inline Editing
```javascript
class HierarchyTreeView {
  startInlineEdit(nodeId) {
    // Use mapping to directly access element
    const nodeElement = this.nodeMapping.modelToView.get(nodeId);
    if (!nodeElement) return;
    
    const valueElement = nodeElement.querySelector('.node-value');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valueElement.textContent;
    input.className = 'inline-editor';
    
    valueElement.replaceWith(input);
    input.focus();
    input.select();
    
    input.addEventListener('blur', () => this.commitEdit(nodeId, input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.commitEdit(nodeId, input.value);
      } else if (e.key === 'Escape') {
        this.cancelEdit(nodeId);
      }
    });
  }
}
```

#### Structural Operations
```javascript
class EditingManager {
  addNode(parentId, type = 'value') {
    const nodeData = {
      type: type,
      name: this.generateNodeName(parentId, type),
      value: this.getDefaultValue(type)
    };
    
    this.model.addNode(parentId, nodeData);
  }

  removeNode(nodeId) {
    this.model.removeNode(nodeId);
  }

  moveNode(nodeId, newParentId, position) {
    this.model.moveNode(nodeId, newParentId, position);
  }

  duplicateNode(nodeId) {
    const node = this.model.findNode(nodeId);
    const clone = this.cloneNode(node);
    this.model.addNode(node.parent.id, clone);
  }
}
```

### Usage Example

```javascript
// Create HierarchyEditor instance
const editor = HierarchyEditor.create({
  dom: document.getElementById('editor-container'),
  format: 'json',
  content: '{"name": "example", "value": 42}',
  editable: true,
  
  // Event handlers
  onContentChange: (content, format) => {
    console.log('Content changed:', content);
  },
  
  onNodeEdit: (node) => {
    console.log('Node edited:', node);
  },
  
  onValidationError: (errors) => {
    console.log('Validation errors:', errors);
  }
});

// Load different format
editor.loadContent('<root><item>value</item></root>', 'xml');

// Get current content
const content = editor.getContent(); // Returns serialized format

// Switch view mode
editor.setMode('source');

// Add a new node
editor.addNode(parentId, {
  type: 'value',
  name: 'newField',
  value: 'newValue'
});
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Set up MVVM structure using base classes
2. Implement unified data model
3. Create basic tree view rendering
4. Implement JSON format handler

### Phase 2: Multi-Format Support (Week 2)
1. Add XML format handler
2. Add YAML format handler
3. Add Markdown format handler
4. Implement format detection

### Phase 3: Editing Capabilities (Week 3)
1. Implement inline editing
2. Add structural operations (add/remove)
3. Create source view with syntax highlighting
4. Add view mode switching

## API Reference

### Component Creation
```javascript
HierarchyEditor.create({
  // Required
  dom: HTMLElement,           // Container element
  
  // Content
  content: string,           // Initial content
  format: string,           // Format: 'json', 'xml', 'yaml', 'markdown'
  
  // Features
  editable: boolean,        // Enable editing (default: true)
  showToolbar: boolean,     // Show mode toolbar (default: true)
  defaultMode: string,      // Initial view mode (default: 'tree')
  
  // Callbacks
  onContentChange: Function,    // (content, format) => void
  onNodeEdit: Function,        // (node) => void
  onNodeAdd: Function,         // (parent, node) => void
  onNodeRemove: Function,      // (node) => void
  onFormatChange: Function,    // (format) => void
  onValidationError: Function, // (errors) => void
  onModeChange: Function,      // (mode) => void
});
```

### Instance Methods
```javascript
// Content management
editor.loadContent(content, format)
editor.getContent()
editor.setFormat(format)
editor.clear()

// View control
editor.setMode(mode)  // 'tree' or 'source'
editor.expandAll()
editor.collapseAll()
editor.expandToLevel(level)

// Editing operations
editor.addNode(parentId, nodeData)
editor.updateNode(nodeId, value)
editor.removeNode(nodeId)
editor.moveNode(nodeId, newParentId)

// Search and selection
editor.findNodes(query)
editor.selectNode(nodeId)
editor.getSelectedNode()

// Utility
editor.validate()
editor.isDirty()
editor.destroy()
```

## Summary

HierarchyEditor provides a powerful, flexible solution for viewing and editing structured data in multiple formats. By leveraging the umbilical protocol and MVVM architecture, it maintains clean separation of concerns while providing rich functionality. The component reuses patterns from existing components (TreeScribe's parsing, Grid's editing, CodeEditor's syntax highlighting) while introducing new capabilities for bidirectional format handling and native format display.