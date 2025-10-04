/**
 * HierarchyEditorDemoModel - Model for the HierarchyEditor demo component
 * 
 * Manages state for multiple editor instances and demo features
 */

import { BaseModel } from '@legion/components';

export class HierarchyEditorDemoModel extends BaseModel {
  constructor(config = {}) {
    super(config);
    
    // Initialize state
    this.editors = new Map(); // name -> editor instance
    this.eventLog = [];
    this.currentTheme = config.theme || 'light';
    this.isReadOnly = false;
    this.nodeCounts = new Map(); // editor name -> node count
    this.maxEventLogEntries = config.maxEventLogEntries || 20;
    
    // Event listeners for event emitter pattern
    this._eventListeners = new Map();
    
    // Sample data for different formats
    this.sampleData = config.sampleData || {
      json: `{
  "name": "hierarchy-editor",
  "version": "1.0.0",
  "description": "Multi-format editable hierarchy display",
  "features": ["Tree View", "Source View", "Inline Editing"],
  "config": {
    "theme": "light",
    "editable": true,
    "formats": ["json", "xml", "yaml", "markdown"]
  },
  "stats": {
    "lines": 5000,
    "tests": 200,
    "coverage": 95.5
  }
}`,
      xml: `<user id="123" active="true">
  <name>John Doe</name>
  <email>john@example.com</email>
  <preferences>
    <theme>dark</theme>
    <notifications enabled="true">
      <email>daily</email>
      <push>instant</push>
    </notifications>
  </preferences>
  <tags>
    <tag>premium</tag>
    <tag>developer</tag>
  </tags>
</user>`,
      yaml: `name: hierarchy-editor
version: 1.0.0
features:
  - Tree View
  - Source View
  - Inline Editing
  - Syntax Highlighting
config:
  theme: light
  editable: true
  shortcuts:
    save: cmd+s
    undo: cmd+z
dependencies:
  - name: base-component
    version: ^2.0.0
  - name: event-emitter
    version: ^1.0.0`,
      markdown: `# HierarchyEditor Documentation

## Overview
A powerful component for displaying and editing hierarchical data.

## Features
- **Multi-format support**: JSON, XML, YAML, Markdown
- **Dual view modes**: Tree and Source
- **Inline editing**: Direct value modification
- **Real-time sync**: Changes reflected immediately

## Installation
\`\`\`bash
npm install hierarchy-editor
\`\`\`

## Usage
Import and create an instance with your configuration.

### Basic Example
Create an editor with minimal configuration.

### Advanced Example
Use all available options and event handlers.`
    };
  }
  
  // Editor management
  
  registerEditor(name, editor) {
    this.editors.set(name, editor);
    this.emit('editorRegistered', { name, editor });
  }
  
  unregisterEditor(name) {
    const editor = this.editors.get(name);
    if (editor) {
      this.editors.delete(name);
      this.nodeCounts.delete(name);
      this.emit('editorUnregistered', { name, editor });
    }
  }
  
  getEditor(name) {
    return this.editors.get(name);
  }
  
  getAllEditors() {
    return this.editors;
  }
  
  // Event logging
  
  logEvent(type, data) {
    const event = {
      id: Date.now() + Math.random(),
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.eventLog.unshift(event);
    
    // Keep only max entries
    if (this.eventLog.length > this.maxEventLogEntries) {
      this.eventLog = this.eventLog.slice(0, this.maxEventLogEntries);
    }
    
    this.emit('eventLogged', event);
    return event;
  }
  
  clearEventLog() {
    this.eventLog = [];
    this.emit('eventLogCleared');
  }
  
  getEventLog() {
    return [...this.eventLog];
  }
  
  // Theme management
  
  setTheme(theme) {
    if (theme !== this.currentTheme) {
      const oldTheme = this.currentTheme;
      this.currentTheme = theme;
      this.emit('themeChanged', { oldTheme, newTheme: theme });
    }
  }
  
  getTheme() {
    return this.currentTheme;
  }
  
  toggleTheme() {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }
  
  // Read-only state
  
  setReadOnly(readOnly) {
    if (readOnly !== this.isReadOnly) {
      this.isReadOnly = readOnly;
      this.emit('readOnlyChanged', { readOnly });
    }
  }
  
  getReadOnly() {
    return this.isReadOnly;
  }
  
  toggleReadOnly() {
    this.setReadOnly(!this.isReadOnly);
  }
  
  // Node counting
  
  updateNodeCount(editorName, count) {
    this.nodeCounts.set(editorName, count);
    this.emit('nodeCountUpdated', { editorName, count });
  }
  
  getNodeCount(editorName) {
    return this.nodeCounts.get(editorName) || 0;
  }
  
  // Sample data
  
  getSampleData(format) {
    return this.sampleData[format] || '';
  }
  
  getAllSampleFormats() {
    return Object.keys(this.sampleData);
  }
  
  // Utility methods
  
  reset() {
    // Clear all editors
    for (const [name, editor] of this.editors) {
      if (editor && editor.destroy) {
        editor.destroy();
      }
    }
    
    this.editors.clear();
    this.eventLog = [];
    this.nodeCounts.clear();
    this.currentTheme = 'light';
    this.isReadOnly = false;
    
    this.emit('reset');
  }
  
  getState() {
    return {
      editorCount: this.editors.size,
      eventLogCount: this.eventLog.length,
      theme: this.currentTheme,
      readOnly: this.isReadOnly,
      nodeCounts: Object.fromEntries(this.nodeCounts)
    };
  }
  
  // Generate large dataset for testing
  generateLargeDataset(itemCount = 1000) {
    const data = { items: [] };
    for (let i = 0; i < itemCount; i++) {
      data.items.push({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 100,
        active: Math.random() > 0.5,
        category: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        tags: Array.from({ length: Math.floor(Math.random() * 5) }, 
          (_, j) => `tag${j}`)
      });
    }
    return JSON.stringify(data, null, 2);
  }
  
  // Event emitter methods for compatibility with ViewModel
  
  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(listener);
  }
  
  off(event, listener) {
    if (this._eventListeners.has(event)) {
      this._eventListeners.get(event).delete(listener);
    }
  }
  
  emit(event, data) {
    if (this._eventListeners.has(event)) {
      this._eventListeners.get(event).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}