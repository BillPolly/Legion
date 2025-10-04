/**
 * HierarchyEditorDemoView - View for the HierarchyEditor demo component
 * 
 * Handles DOM rendering for the demo interface
 */

import { BaseView } from '@legion/components';

export class HierarchyEditorDemoView extends BaseView {
  constructor(container, config = {}) {
    // Clear any existing content (like "Loading demo...")
    if (container) {
      container.innerHTML = '';
    }
    
    super(container, config);
    
    this.showApiExamples = config.showApiExamples !== false;
    this.editorContainers = new Map(); // name -> container element
    this.statusElements = new Map(); // name -> status elements
    
    // Note: BaseView creates this.container as a child of the passed container
    // this.parentDom is the original container passed in
  }
  
  render() {
    this.container.innerHTML = `
      <div class="hierarchy-editor-demo theme-${this.config.theme || 'light'}">
        <div class="demo-header">
          <h1>HierarchyEditor Component Demo</h1>
          <p class="description">
            A powerful multi-format editable hierarchy display component that supports JSON, XML, YAML, and Markdown.
            Features include inline editing, tree/source view modes, syntax highlighting, and real-time synchronization.
          </p>
        </div>
        
        ${this.renderBasicDemo()}
        ${this.renderFormatDemo()}
        ${this.renderEditDemo()}
        ${this.renderEventDemo()}
        ${this.renderAdvancedDemo()}
        ${this.showApiExamples ? this.renderApiExamples() : ''}
      </div>
    `;
    
    // Store references to containers and status elements
    this.cacheElements();
    
    // Add styles
    this.addStyles();
  }
  
  renderBasicDemo() {
    return `
      <div class="demo-section" data-demo="basic">
        <h2>1. Basic Usage</h2>
        <p class="demo-hint">👆 <strong>Click any value below to edit it!</strong> Use Tree view for inline editing or Source view for raw text editing.</p>
        <div class="demo-controls">
          <select data-action="load-server-file" data-editor="basic" class="sample-selector">
            <option value="">Load Sample File...</option>
            <option value="/data/samples/package.json">Package.json - Project Config</option>
            <option value="/data/samples/user-profile.xml">User Profile - XML</option>
            <option value="/data/samples/application-config.yaml">Application Config - YAML</option>
            <option value="/data/samples/documentation.md">Documentation - Markdown</option>
            <option value="/data/samples/product-catalog.json">Product Catalog - Complex JSON</option>
          </select>
          <input type="file" id="basic-file-input" accept=".json,.xml,.yaml,.yml,.md" style="display: none;">
          <button onclick="document.getElementById('basic-file-input').click()">Upload File</button>
          <button data-action="tree-mode" data-editor="basic">Tree View</button>
          <button data-action="source-mode" data-editor="basic">Source View</button>
          <button data-action="expand-all" data-editor="basic">Expand All</button>
          <button data-action="collapse-all" data-editor="basic">Collapse All</button>
        </div>
        <div class="editor-container" data-editor-container="basic"></div>
        <div class="status-bar">
          <span data-status="basic">Ready - Click values to edit!</span>
          <span data-mode="basic">Mode: tree</span>
        </div>
      </div>
    `;
  }
  
  renderFormatDemo() {
    return `
      <div class="demo-section" data-demo="format">
        <h2>2. Multi-Format Support</h2>
        <div class="demo-controls">
          <select data-action="load-server-file" data-editor="format" class="sample-selector">
            <option value="">Load Sample File...</option>
            <option value="/data/samples/package.json">Package.json - Project Config</option>
            <option value="/data/samples/user-profile.xml">User Profile - XML</option>
            <option value="/data/samples/application-config.yaml">Application Config - YAML</option>
            <option value="/data/samples/documentation.md">Documentation - Markdown</option>
            <option value="/data/samples/product-catalog.json">Product Catalog - Complex JSON</option>
          </select>
          <input type="file" id="format-file-input" accept=".json,.xml,.yaml,.yml,.md" style="display: none;">
          <button onclick="document.getElementById('format-file-input').click()">Upload File</button>
        </div>
        <p style="color: #666; font-size: 14px;">Or click any format below to load sample data:</p>
        <div class="sample-data-grid">
          <div class="sample-data-card" data-format="json" style="cursor: pointer;">
            <h4>📄 JSON</h4>
            <p>Package configuration with nested objects and arrays</p>
            <pre style="font-size: 11px; margin: 5px 0; color: #555; max-height: 60px; overflow: hidden;">
{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {...}
}
            </pre>
          </div>
          <div class="sample-data-card" data-format="xml" style="cursor: pointer;">
            <h4>📋 XML</h4>
            <p>User profile with attributes and nested elements</p>
            <pre style="font-size: 11px; margin: 5px 0; color: #555; max-height: 60px; overflow: hidden;">
&lt;user id="123"&gt;
  &lt;name&gt;John Doe&lt;/name&gt;
  &lt;preferences&gt;...&lt;/preferences&gt;
&lt;/user&gt;
            </pre>
          </div>
          <div class="sample-data-card" data-format="yaml" style="cursor: pointer;">
            <h4>⚙️ YAML</h4>
            <p>Configuration file with various data types</p>
            <pre style="font-size: 11px; margin: 5px 0; color: #555; max-height: 60px; overflow: hidden;">
name: my-app
version: 1.0.0
features:
  - Tree View
  - Source View
            </pre>
          </div>
          <div class="sample-data-card" data-format="markdown" style="cursor: pointer;">
            <h4>📝 Markdown</h4>
            <p>Documentation with headings and content</p>
            <pre style="font-size: 11px; margin: 5px 0; color: #555; max-height: 60px; overflow: hidden;">
# Documentation
## Overview
- Feature 1
- Feature 2
            </pre>
          </div>
        </div>
        <div class="editor-container" data-editor-container="format"></div>
        <div class="status-bar">
          <span data-status="format">Click a format above to load sample data</span>
          <span data-format-info="format">Format: none</span>
        </div>
      </div>
    `;
  }
  
  renderEditDemo() {
    return `
      <div class="demo-section" data-demo="edit">
        <h2>3. Editing Capabilities</h2>
        <p class="demo-hint">Double-click values to edit inline. Use the buttons to add/remove nodes.</p>
        <div class="demo-controls">
          <select data-action="load-server-file" data-editor="edit" class="sample-selector">
            <option value="">Load Sample File...</option>
            <option value="/data/samples/package.json">Package.json - Project Config</option>
            <option value="/data/samples/user-profile.xml">User Profile - XML</option>
            <option value="/data/samples/application-config.yaml">Application Config - YAML</option>
            <option value="/data/samples/documentation.md">Documentation - Markdown</option>
            <option value="/data/samples/product-catalog.json">Product Catalog - Complex JSON</option>
          </select>
          <input type="file" id="edit-file-input" accept=".json,.xml,.yaml,.yml,.md" style="display: none;">
          <button onclick="document.getElementById('edit-file-input').click()">Upload File</button>
          <button data-action="add-node" data-editor="edit">Add Node</button>
          <button data-action="delete-selected" data-editor="edit">Delete Selected</button>
          <button data-action="bulk-add" data-editor="edit">Bulk Add (5 items)</button>
          <button data-action="clear" data-editor="edit">Clear</button>
          <button data-action="download" data-editor="edit">Download</button>
        </div>
        <div class="editor-container" data-editor-container="edit"></div>
        <div class="status-bar">
          <span data-status="edit">Double-click any value to edit</span>
          <span data-node-count="edit">Nodes: <span class="count">0</span></span>
        </div>
      </div>
    `;
  }
  
  renderEventDemo() {
    return `
      <div class="demo-section" data-demo="event">
        <h2>4. Event System</h2>
        <p class="demo-hint">Interact with the editor below to see events in real-time.</p>
        <div class="demo-controls">
          <select data-action="load-server-file" data-editor="event" class="sample-selector">
            <option value="">Load Sample File...</option>
            <option value="/data/samples/package.json">Package.json - Project Config</option>
            <option value="/data/samples/user-profile.xml">User Profile - XML</option>
            <option value="/data/samples/application-config.yaml">Application Config - YAML</option>
            <option value="/data/samples/documentation.md">Documentation - Markdown</option>
            <option value="/data/samples/product-catalog.json">Product Catalog - Complex JSON</option>
          </select>
          <input type="file" id="event-file-input" accept=".json,.xml,.yaml,.yml,.md" style="display: none;">
          <button onclick="document.getElementById('event-file-input').click()">Upload File</button>
          <button data-action="clear-log">Clear Log</button>
          <button data-action="programmatic-edit" data-editor="event">Programmatic Edit</button>
          <button data-action="programmatic-add" data-editor="event">Programmatic Add</button>
        </div>
        <div class="editor-container" data-editor-container="event" style="height: 300px;"></div>
        <h3>Event Log:</h3>
        <div class="event-log" data-event-log></div>
      </div>
    `;
  }
  
  renderAdvancedDemo() {
    return `
      <div class="demo-section" data-demo="advanced">
        <h2>5. Advanced Features</h2>
        <div class="demo-controls">
          <select data-action="load-server-file" data-editor="advanced" class="sample-selector">
            <option value="">Load Sample File...</option>
            <option value="/data/samples/package.json">Package.json - Project Config</option>
            <option value="/data/samples/user-profile.xml">User Profile - XML</option>
            <option value="/data/samples/application-config.yaml">Application Config - YAML</option>
            <option value="/data/samples/documentation.md">Documentation - Markdown</option>
            <option value="/data/samples/product-catalog.json">Product Catalog - Complex JSON</option>
          </select>
          <input type="file" id="advanced-file-input" accept=".json,.xml,.yaml,.yml,.md" style="display: none;">
          <button onclick="document.getElementById('advanced-file-input').click()">Upload File</button>
          <button data-action="toggle-theme">Toggle Theme</button>
          <button data-action="toggle-readonly">Toggle Read-Only</button>
          <button data-action="export-data" data-editor="advanced">Export Data</button>
          <button data-action="validate" data-editor="advanced">Validate</button>
          <button data-action="large-dataset" data-editor="advanced">Load Large Dataset</button>
        </div>
        <div class="editor-container" data-editor-container="advanced"></div>
        <div class="status-bar">
          <span data-status="advanced">Ready</span>
          <span data-info="advanced">Theme: light | Editable: true</span>
        </div>
      </div>
    `;
  }
  
  renderApiExamples() {
    return `
      <div class="demo-section" data-demo="api">
        <h2>6. API Usage Examples</h2>
        <pre class="code-example">
// Create a new HierarchyEditor instance
const editor = HierarchyEditor.create({
    dom: document.getElementById('my-container'),
    content: '{"hello": "world"}',
    format: 'json',
    theme: 'light',
    editable: true,
    showToolbar: true,
    
    // Event callbacks
    onContentChange: (event) => {
        console.log('Content changed:', event.content);
    },
    onNodeEdit: (event) => {
        console.log('Node edited:', event.path, event.newValue);
    },
    onError: (error) => {
        console.error('Error:', error.message);
    }
});

// Render the editor
editor.render();

// Programmatic operations
editor.setMode('source');              // Switch to source view
editor.expandAll();                    // Expand all nodes
editor.selectNode('user.name');        // Select a specific node
editor.editNode('user.age', 25);       // Edit a value
editor.addNode('items', 'new item');   // Add to array
editor.deleteNode('temp');             // Delete a node

// Get current content
const content = editor.getContent();

// Load new content
editor.loadContent('{"new": "data"}');

// Destroy when done
editor.destroy();
        </pre>
      </div>
    `;
  }
  
  cacheElements() {
    // Cache editor containers
    this.container.querySelectorAll('[data-editor-container]').forEach(el => {
      const name = el.dataset.editorContainer;
      this.editorContainers.set(name, el);
    });
    
    // Cache status elements
    this.statusElements.set('basic', {
      status: this.container.querySelector('[data-status="basic"]'),
      mode: this.container.querySelector('[data-mode="basic"]')
    });
    
    this.statusElements.set('format', {
      status: this.container.querySelector('[data-status="format"]'),
      formatInfo: this.container.querySelector('[data-format-info="format"]')
    });
    
    this.statusElements.set('edit', {
      status: this.container.querySelector('[data-status="edit"]'),
      nodeCount: this.container.querySelector('[data-node-count="edit"] .count')
    });
    
    this.statusElements.set('event', {
      eventLog: this.container.querySelector('[data-event-log]')
    });
    
    this.statusElements.set('advanced', {
      status: this.container.querySelector('[data-status="advanced"]'),
      info: this.container.querySelector('[data-info="advanced"]')
    });
  }
  
  getEditorContainer(name) {
    return this.editorContainers.get(name);
  }
  
  updateStatus(editorName, text) {
    const status = this.statusElements.get(editorName);
    if (status && status.status) {
      status.status.textContent = text;
    }
  }
  
  updateMode(editorName, mode) {
    const status = this.statusElements.get(editorName);
    if (status && status.mode) {
      status.mode.textContent = `Mode: ${mode}`;
    }
  }
  
  updateFormatInfo(format) {
    const status = this.statusElements.get('format');
    if (status && status.formatInfo) {
      status.formatInfo.textContent = `Format: ${format}`;
    }
  }
  
  updateNodeCount(count) {
    const status = this.statusElements.get('edit');
    if (status && status.nodeCount) {
      status.nodeCount.textContent = count;
    }
  }
  
  updateAdvancedInfo(theme, editable) {
    const status = this.statusElements.get('advanced');
    if (status && status.info) {
      status.info.textContent = `Theme: ${theme} | Editable: ${editable}`;
    }
  }
  
  addEventToLog(event) {
    const eventLog = this.statusElements.get('event').eventLog;
    if (!eventLog) return;
    
    const eventEl = document.createElement('div');
    eventEl.className = 'event';
    eventEl.innerHTML = `<span class="event-type">${event.type}</span>: ${JSON.stringify(event.data)}`;
    
    eventLog.insertBefore(eventEl, eventLog.firstChild);
  }
  
  clearEventLog() {
    const eventLog = this.statusElements.get('event').eventLog;
    if (eventLog) {
      eventLog.innerHTML = '';
    }
  }
  
  updateTheme(theme) {
    const demoEl = this.container.querySelector('.hierarchy-editor-demo');
    if (demoEl) {
      demoEl.className = demoEl.className.replace(/theme-\w+/, `theme-${theme}`);
    }
  }
  
  highlightFormatCard(format) {
    // Remove previous highlights
    this.container.querySelectorAll('.sample-data-card').forEach(card => {
      card.classList.remove('active');
    });
    
    // Highlight selected format
    const card = this.container.querySelector(`[data-format="${format}"]`);
    if (card) {
      card.classList.add('active');
    }
  }
  
  addStyles() {
    if (document.getElementById('hierarchy-editor-demo-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hierarchy-editor-demo-styles';
    style.textContent = `
      .hierarchy-editor-demo {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .demo-header {
        margin-bottom: 30px;
      }
      
      .demo-header h1 {
        color: #333;
        margin-bottom: 10px;
      }
      
      .demo-header .description {
        color: #666;
        line-height: 1.6;
      }
      
      .demo-section {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 20px;
        margin-bottom: 20px;
      }
      
      .demo-section h2 {
        color: #444;
        margin-top: 0;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
      }
      
      .demo-hint {
        color: #666;
        font-size: 14px;
        margin-bottom: 10px;
      }
      
      .demo-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
      }
      
      .demo-controls button {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .demo-controls button:hover {
        background: #f0f0f0;
        border-color: #999;
      }
      
      .demo-controls button.active {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .sample-selector {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        min-width: 200px;
      }
      
      .sample-selector:hover {
        background: #f0f0f0;
        border-color: #999;
      }
      
      .editor-container {
        border: 1px solid #ddd;
        border-radius: 4px;
        height: 400px;
        overflow: auto;
        background: white;
      }
      
      .status-bar {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        background: #f8f9fa;
        border-top: 1px solid #ddd;
        font-size: 12px;
        color: #666;
      }
      
      .sample-data-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
        margin-bottom: 15px;
      }
      
      .sample-data-card {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .sample-data-card:hover {
        background: #f0f0f0;
        border-color: #999;
      }
      
      .sample-data-card.active {
        background: #e3f2fd;
        border-color: #2196f3;
      }
      
      .sample-data-card h4 {
        margin: 0 0 5px 0;
        color: #333;
      }
      
      .sample-data-card p {
        margin: 0;
        font-size: 12px;
        color: #666;
      }
      
      .event-log {
        height: 200px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        background: #f8f9fa;
      }
      
      .event-log .event {
        margin-bottom: 5px;
        padding: 5px;
        background: white;
        border-radius: 3px;
      }
      
      .event-log .event-type {
        font-weight: bold;
        color: #007bff;
      }
      
      .code-example {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 14px;
      }
      
      /* Dark theme */
      .hierarchy-editor-demo.theme-dark {
        background: #1e1e1e;
        color: #d4d4d4;
      }
      
      .theme-dark .demo-section {
        background: #2d2d2e;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      
      .theme-dark .demo-header h1 {
        color: #d4d4d4;
      }
      
      .theme-dark .demo-section h2 {
        color: #d4d4d4;
        border-bottom-color: #464647;
      }
      
      .theme-dark .demo-controls button {
        background: #3c3c3c;
        border-color: #464647;
        color: #d4d4d4;
      }
      
      .theme-dark .demo-controls button:hover {
        background: #464647;
      }
      
      .theme-dark .sample-selector {
        background: #3c3c3c;
        border-color: #464647;
        color: #d4d4d4;
      }
      
      .theme-dark .sample-selector:hover {
        background: #464647;
      }
      
      .theme-dark .editor-container {
        background: #1e1e1e;
        border-color: #464647;
      }
      
      .theme-dark .status-bar {
        background: #252526;
        border-color: #464647;
      }
      
      .theme-dark .sample-data-card {
        background: #2d2d2e;
        border-color: #464647;
      }
      
      .theme-dark .sample-data-card:hover {
        background: #3c3c3c;
      }
      
      .theme-dark .sample-data-card.active {
        background: #094771;
        border-color: #007acc;
      }
      
      .theme-dark .event-log {
        background: #252526;
        border-color: #464647;
      }
      
      .theme-dark .event-log .event {
        background: #3c3c3c;
      }
      
      .theme-dark .code-example {
        background: #252526;
        color: #d4d4d4;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  destroy() {
    // Clear containers
    this.editorContainers.clear();
    this.statusElements.clear();
    
    super.destroy();
  }
}