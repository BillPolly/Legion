# Component Editor - Design Document

## Overview

The Component Editor is a comprehensive visual development environment for creating, editing, testing, and managing declarative UI components. It enables both humans and AI agents to collaboratively build components using CNL (Controlled Natural Language), DSL, or direct JSON manipulation, with live preview, instant testing, and persistent storage.

This is an **Umbilical MVVM component** that integrates seamlessly with Legion's declarative components system, Handle architecture, and Actor-based backend communication.

## Core Philosophy

**"Components are data that can be edited, tested, and stored like any other resource"**

- Components are represented as **Handles** (not just code)
- Component definitions (DSL/CNL/JSON) are **first-class data**
- The editor itself is a **declarative component** (meta-component)
- All operations go through **Actors** for backend persistence
- Live preview uses the **actual component runtime**
- AI agents can edit components as **structured data**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Editor                          │
│                  (Umbilical MVVM Component)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │   Editors    │  │   Preview    │      │
│  │   (Model)    │  │   (View)     │  │   (View)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                          │                                   │
│                  ┌───────▼───────┐                          │
│                  │   ViewModel   │                          │
│                  └───────┬───────┘                          │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Umbilical  │ ◄── Injected dependencies
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐    ┌─────▼─────┐
   │  DOM    │      │   Backend   │    │Component  │
   │Container│      │    Actor    │    │  Store    │
   └─────────┘      └─────────────┘    │ (Handle)  │
                                        └───────────┘
```

## Component Handle Architecture

### ComponentHandle Class

Components are represented as Handles that provide structured access to component data and metadata:

```javascript
class ComponentHandle extends Handle {
  constructor(dataSource, componentId) {
    super(dataSource);
    this.componentId = componentId;

    // Schema-based prototype provides properties:
    // - name: string
    // - description: string
    // - dsl: string
    // - cnl: string
    // - json: object
    // - author: string
    // - tags: array
    // - created: date
    // - modified: date
    // - version: number
  }

  // Conversion methods
  toDSL() { return this.dsl; }
  toCNL() { return this.cnl; }
  toJSON() { return this.json; }

  // Validation
  validate() { /* Validate component definition */ }

  // Testing
  async test(testData) { /* Execute component tests */ }

  // Projection
  dataModel() { /* Return ComponentDataModelHandle */ }
  metadata() { /* Return ComponentMetadataHandle */ }
}
```

### ComponentLibraryHandle

The component library is a collection Handle that manages all saved components:

```javascript
class ComponentLibraryHandle extends Handle {
  // Query components
  all() { return Array<ComponentHandle>; }
  byTag(tag) { return Array<ComponentHandle>; }
  byAuthor(author) { return Array<ComponentHandle>; }
  byCategory(category) { return Array<ComponentHandle>; }
  recent(limit) { return Array<ComponentHandle>; }
  filter(predicate) { return Array<ComponentHandle>; } // Simple client-side filtering

  // CRUD operations
  create(componentData) { return ComponentHandle; }
  get(componentId) { return ComponentHandle; }
  update(componentId, data) { return ComponentHandle; }
  delete(componentId) { return boolean; }

  // Batch operations
  import(components) { return Array<ComponentHandle>; }
  export(componentIds) { return Array<ComponentData>; }
}
```

## Component Data Model

### Component Definition Schema

Every component has a structured data model stored in the backend:

```javascript
{
  // Identity
  id: "component_uuid",
  name: "UserProfileCard",
  description: "Displays user profile with avatar, name, and bio",

  // Component Definitions (all three formats stored)
  dsl: `
    UserProfileCard :: user =>
      div.profile-card [
        img.avatar[src={user.avatar}]
        h2.name { user.name }
        p.bio { user.bio }
      ]
  `,

  cnl: `
    Define UserProfileCard with user:
      A container with class "profile-card" containing:
        An image with class "avatar" showing user avatar
        A heading showing user name
        A paragraph showing user bio
  `,

  json: {
    name: "UserProfileCard",
    entity: "user",
    structure: { /* ... */ },
    bindings: [ /* ... */ ],
    events: [ /* ... */ ]
  },

  // Data Model (schema for component's entity)
  dataModel: {
    entityName: "user",
    schema: {
      avatar: { type: "string", description: "User avatar URL" },
      name: { type: "string", description: "User full name" },
      bio: { type: "string", description: "User biography" }
    },
    sampleData: {
      avatar: "https://example.com/avatar.jpg",
      name: "John Doe",
      bio: "Software developer and open source contributor"
    }
  },

  // Metadata
  author: "human|ai|collaborative",
  authorDetails: {
    type: "human",
    userId: "user_123",
    name: "Alice Developer"
  },
  tags: ["profile", "user", "card"],
  category: "user-interface",

  // Lifecycle
  created: "2025-10-04T12:00:00Z",
  modified: "2025-10-04T14:30:00Z",
  version: 3,

  // Testing
  tests: [
    {
      name: "should display user name",
      data: { name: "Test User", avatar: "", bio: "" },
      assertions: [
        { selector: ".name", property: "textContent", equals: "Test User" }
      ]
    }
  ],

  // Usage tracking (optional for MVP)
  usageCount: 42,
  lastUsed: "2025-10-04T14:00:00Z"
}
```

### Component Data Model Handle

Separate Handle for managing component's data schema:

```javascript
class ComponentDataModelHandle extends Handle {
  // Schema definition
  get entityName() { return this.schema.entityName; }
  get schema() { return this.schemaDefinition; }
  get sampleData() { return this.sample; }

  // Schema operations
  addField(name, type, description) { /* Add field to schema */ }
  removeField(name) { /* Remove field */ }
  updateField(name, updates) { /* Modify field definition */ }

  // Sample data
  updateSampleData(data) { /* Update sample data for preview */ }
  validateData(data) { /* Validate against schema */ }

  // Generation
  generateSampleData() { /* Auto-generate sample data from schema */ }
}
```

## Umbilical MVVM Architecture

### Umbilical Interface

The component editor receives all dependencies through the umbilical:

```javascript
const ComponentEditor = {
  create(umbilical) {
    // REQUIRED umbilical properties:
    const {
      dom,                    // HTMLElement - Container for editor
      backend,                // Actor - Backend communication
      componentStore,         // ComponentLibraryHandle - Component storage
      dataStore,              // DataStore - For preview components
    } = umbilical;

    // OPTIONAL umbilical properties:
    const {
      initialComponent,       // ComponentHandle - Component to edit (null = new)
      mode,                   // 'edit'|'view'|'create' - Editor mode
      theme,                  // 'light'|'dark' - Visual theme
      onComponentSaved,       // Function - Callback when saved
      onComponentDeleted,     // Function - Callback when deleted
      onClose,                // Function - Callback when editor closes
    } = umbilical;

    // Validate required dependencies
    UmbilicalUtils.validateCapabilities(umbilical,
      ['dom', 'backend', 'componentStore', 'dataStore'],
      'ComponentEditor'
    );

    // Create MVVM layers
    const model = new ComponentEditorModel({ componentStore, backend });
    const view = new ComponentEditorView({ dom, theme });
    const viewModel = new ComponentEditorViewModel({ model, view, dataStore });

    // Initialize with initial component if provided
    if (initialComponent) {
      viewModel.loadComponent(initialComponent);
    }

    // Return public API
    return {
      loadComponent(componentIdOrHandle),
      saveComponent(),
      deleteComponent(),
      testComponent(testData),
      destroy()
    };
  }
};
```

### Model Layer

**ComponentEditorModel** - Manages component data and backend operations:

```javascript
class ComponentEditorModel {
  constructor({ componentStore, backend }) {
    this.componentStore = componentStore;  // ComponentLibraryHandle
    this.backend = backend;                // Backend Actor

    // Current state
    this.currentComponent = null;          // ComponentHandle
    this.isDirty = false;                  // Unsaved changes
    this.validationErrors = [];

    // Editing state
    this.activeFormat = 'dsl';             // 'dsl'|'cnl'|'json'|'dataModel'
    this.dslContent = '';
    this.cnlContent = '';
    this.jsonContent = {};
    this.dataModelContent = {};
  }

  // Component operations
  async loadComponent(componentId) {
    this.currentComponent = await this.componentStore.get(componentId);
    this.dslContent = this.currentComponent.dsl;
    this.cnlContent = this.currentComponent.cnl;
    this.jsonContent = this.currentComponent.json;
    this.dataModelContent = this.currentComponent.dataModel;
    this.isDirty = false;
  }

  async saveComponent() {
    if (!this.validate()) {
      throw new Error('Validation failed: ' + this.validationErrors.join(', '));
    }

    const componentData = {
      dsl: this.dslContent,
      cnl: this.cnlContent,
      json: this.jsonContent,
      dataModel: this.dataModelContent,
      modified: new Date().toISOString()
    };

    if (this.currentComponent) {
      // Update existing
      this.currentComponent = await this.componentStore.update(
        this.currentComponent.id,
        componentData
      );
    } else {
      // Create new
      this.currentComponent = await this.componentStore.create(componentData);
    }

    this.isDirty = false;
    return this.currentComponent;
  }

  async deleteComponent() {
    if (!this.currentComponent) return false;
    return await this.componentStore.delete(this.currentComponent.id);
  }

  // Format conversion
  convertDSLtoCNL() {
    this.cnlContent = dslToCNL(this.dslContent);
  }

  convertCNLtoDSL() {
    this.dslContent = cnlToDSL(this.cnlContent);
  }

  convertToJSON() {
    // Parse DSL/CNL to JSON
    const parser = new Parser(this.dslContent);
    this.jsonContent = parser.parse();
  }

  // Validation
  validate() {
    this.validationErrors = [];

    try {
      // Validate DSL syntax
      const parser = new Parser(this.dslContent);
      parser.parse();
    } catch (error) {
      this.validationErrors.push(`DSL: ${error.message}`);
    }

    // Validate data model
    if (!this.dataModelContent.entityName) {
      this.validationErrors.push('Data model: Entity name required');
    }

    return this.validationErrors.length === 0;
  }

  // Testing
  async runTests(testData) {
    // Execute component with test data
    // Return test results
  }
}
```

### View Layer

**ComponentEditorView** - Manages DOM rendering and user interactions:

```javascript
class ComponentEditorView {
  constructor({ dom, theme }) {
    this.container = dom;
    this.theme = theme || 'light';

    // DOM references (created during render)
    this.elements = {
      toolbar: null,
      editorPane: null,
      previewPane: null,
      browserPane: null,
      dataModelPane: null,
      testPane: null
    };

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="component-editor ${this.theme}">
        <!-- Toolbar -->
        <div class="editor-toolbar">
          <button class="btn-save">Save</button>
          <button class="btn-test">Test</button>
          <button class="btn-preview">Preview</button>
          <select class="format-selector">
            <option value="dsl">DSL</option>
            <option value="cnl">CNL</option>
            <option value="json">JSON</option>
            <option value="dataModel">Data Model</option>
          </select>
        </div>

        <!-- Main Layout (3-pane) -->
        <div class="editor-layout">
          <!-- Left: Browser -->
          <div class="browser-pane">
            <div class="browser-header">Component Library</div>
            <div class="browser-filter">
              <input type="text" class="filter-input" placeholder="Filter by name..." />
              <select class="filter-tag">
                <option value="">All Tags</option>
              </select>
              <select class="filter-author">
                <option value="">All Authors</option>
              </select>
            </div>
            <div class="browser-list"></div>
          </div>

          <!-- Center: Editor -->
          <div class="editor-pane">
            <div class="editor-tabs">
              <button class="tab active" data-tab="dsl">DSL</button>
              <button class="tab" data-tab="cnl">CNL</button>
              <button class="tab" data-tab="json">JSON</button>
              <button class="tab" data-tab="dataModel">Data Model</button>
            </div>
            <div class="editor-content">
              <textarea class="editor-dsl" placeholder="Enter DSL..."></textarea>
              <textarea class="editor-cnl" style="display:none" placeholder="Enter CNL..."></textarea>
              <textarea class="editor-json" style="display:none" placeholder="JSON..."></textarea>
              <div class="editor-datamodel" style="display:none">
                <!-- Data model editor (schema builder) -->
              </div>
            </div>
            <div class="editor-status">
              <span class="validation-status"></span>
            </div>
          </div>

          <!-- Right: Preview + Tests -->
          <div class="preview-pane">
            <div class="preview-tabs">
              <button class="tab active" data-tab="preview">Preview</button>
              <button class="tab" data-tab="tests">Tests</button>
            </div>
            <div class="preview-content">
              <div class="preview-container"></div>
              <div class="test-results" style="display:none"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache DOM references
    this.elements.toolbar = this.container.querySelector('.editor-toolbar');
    this.elements.editorPane = this.container.querySelector('.editor-pane');
    this.elements.previewPane = this.container.querySelector('.preview-pane');
    this.elements.browserPane = this.container.querySelector('.browser-pane');
  }

  // Editor operations
  setEditorContent(format, content) {
    const editor = this.container.querySelector(`.editor-${format}`);
    if (editor) {
      editor.value = content;
    }
  }

  getEditorContent(format) {
    const editor = this.container.querySelector(`.editor-${format}`);
    return editor ? editor.value : '';
  }

  // Browser operations
  renderComponentList(components) {
    const list = this.container.querySelector('.browser-list');
    list.innerHTML = components.map(component => `
      <div class="component-item" data-id="${component.id}">
        <div class="component-name">${component.name}</div>
        <div class="component-tags">${component.tags.join(', ')}</div>
      </div>
    `).join('');
  }

  // Preview operations
  renderPreview(componentInstance) {
    const container = this.container.querySelector('.preview-container');
    container.innerHTML = '';
    // Component instance already mounted, just update reference
  }

  showTestResults(results) {
    const testContainer = this.container.querySelector('.test-results');
    testContainer.innerHTML = `
      <div class="test-summary">
        ${results.passed} passed, ${results.failed} failed
      </div>
      ${results.tests.map(test => `
        <div class="test-result ${test.passed ? 'pass' : 'fail'}">
          <div class="test-name">${test.name}</div>
          <div class="test-message">${test.message || ''}</div>
        </div>
      `).join('')}
    `;
  }

  // Validation feedback
  showValidationErrors(errors) {
    const status = this.container.querySelector('.validation-status');
    if (errors.length === 0) {
      status.textContent = '✓ Valid';
      status.className = 'validation-status valid';
    } else {
      status.textContent = `✗ ${errors.length} error(s)`;
      status.className = 'validation-status invalid';
      status.title = errors.join('\n');
    }
  }

  // Event handler setup
  onSaveClick(handler) {
    this.container.querySelector('.btn-save').addEventListener('click', handler);
  }

  onTestClick(handler) {
    this.container.querySelector('.btn-test').addEventListener('click', handler);
  }

  onFormatChange(handler) {
    this.container.querySelector('.format-selector').addEventListener('change', handler);
  }

  onEditorChange(format, handler) {
    const editor = this.container.querySelector(`.editor-${format}`);
    editor.addEventListener('input', handler);
  }

  onComponentSelect(handler) {
    this.container.querySelector('.browser-list').addEventListener('click', (e) => {
      const item = e.target.closest('.component-item');
      if (item) {
        handler(item.dataset.id);
      }
    });
  }
}
```

### ViewModel Layer

**ComponentEditorViewModel** - Coordinates Model and View:

```javascript
class ComponentEditorViewModel {
  constructor({ model, view, dataStore }) {
    this.model = model;
    this.view = view;
    this.dataStore = dataStore;

    // Preview component instance
    this.previewLifecycle = new ComponentLifecycle(dataStore);
    this.previewComponent = null;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Save
    this.view.onSaveClick(() => this.handleSave());

    // Test
    this.view.onTestClick(() => this.handleTest());

    // Format change
    this.view.onFormatChange((e) => this.handleFormatChange(e.target.value));

    // Editor changes
    this.view.onEditorChange('dsl', () => this.handleDSLChange());
    this.view.onEditorChange('cnl', () => this.handleCNLChange());
    this.view.onEditorChange('json', () => this.handleJSONChange());

    // Component selection
    this.view.onComponentSelect((id) => this.loadComponent(id));
  }

  async loadComponent(componentId) {
    await this.model.loadComponent(componentId);

    // Update view
    this.view.setEditorContent('dsl', this.model.dslContent);
    this.view.setEditorContent('cnl', this.model.cnlContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));

    // Update preview
    await this.updatePreview();
  }

  async handleSave() {
    try {
      const component = await this.model.saveComponent();
      // Show success message
      console.log('Component saved:', component.id);
    } catch (error) {
      // Show error
      console.error('Save failed:', error.message);
    }
  }

  async handleTest() {
    const testData = this.model.dataModelContent.sampleData;
    const results = await this.model.runTests(testData);
    this.view.showTestResults(results);
  }

  handleFormatChange(format) {
    this.model.activeFormat = format;
    // Show/hide appropriate editor
  }

  handleDSLChange() {
    this.model.dslContent = this.view.getEditorContent('dsl');
    this.model.isDirty = true;

    // Auto-convert to other formats
    this.model.convertDSLtoCNL();
    this.model.convertToJSON();

    // Update other editors
    this.view.setEditorContent('cnl', this.model.cnlContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));

    // Validate
    this.model.validate();
    this.view.showValidationErrors(this.model.validationErrors);

    // Update preview (debounced)
    this.debouncePreviewUpdate();
  }

  handleCNLChange() {
    this.model.cnlContent = this.view.getEditorContent('cnl');
    this.model.isDirty = true;

    // Auto-convert to DSL and JSON
    this.model.convertCNLtoDSL();
    this.model.convertToJSON();

    this.view.setEditorContent('dsl', this.model.dslContent);
    this.view.setEditorContent('json', JSON.stringify(this.model.jsonContent, null, 2));

    this.debouncePreviewUpdate();
  }

  async updatePreview() {
    // Unmount previous preview
    if (this.previewComponent) {
      await this.previewComponent.unmount();
    }

    // Mount new preview with sample data
    const container = this.view.container.querySelector('.preview-container');
    const sampleData = this.model.dataModelContent.sampleData;

    try {
      this.previewComponent = await this.previewLifecycle.mount(
        this.model.dslContent,
        container,
        sampleData
      );
    } catch (error) {
      container.innerHTML = `<div class="preview-error">Preview Error: ${error.message}</div>`;
    }
  }

  debouncePreviewUpdate() {
    clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => {
      this.updatePreview();
    }, 500);
  }
}
```

## Backend Actor Communication

### ComponentStoreActor

Backend Actor that manages component persistence:

```javascript
class ComponentStoreActor extends Actor {
  constructor(database) {
    super();
    this.db = database; // MongoDB/SQLite/etc.
    this.collection = 'components';
  }

  async receive(messageType, data) {
    switch (messageType) {
      case 'component.create':
        return await this.createComponent(data);

      case 'component.get':
        return await this.getComponent(data.id);

      case 'component.update':
        return await this.updateComponent(data.id, data.updates);

      case 'component.delete':
        return await this.deleteComponent(data.id);

      case 'component.list':
        return await this.listComponents(data.filter);

      case 'component.import':
        return await this.importComponents(data.components);

      case 'component.export':
        return await this.exportComponents(data.ids);

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  async createComponent(componentData) {
    const component = {
      id: generateUUID(),
      ...componentData,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1
    };

    await this.db.insert(this.collection, component);
    return component;
  }

  async getComponent(id) {
    return await this.db.findOne(this.collection, { id });
  }

  async updateComponent(id, updates) {
    const component = await this.getComponent(id);
    if (!component) throw new Error('Component not found');

    const updated = {
      ...component,
      ...updates,
      modified: new Date().toISOString(),
      version: component.version + 1
    };

    await this.db.update(this.collection, { id }, updated);
    return updated;
  }

  async deleteComponent(id) {
    await this.db.delete(this.collection, { id });
    return true;
  }

  async listComponents(filter = {}) {
    // Simple filtering by exact matches on fields
    // Example: { tag: 'profile' } or { author: 'alice' } or { category: 'forms' }
    return await this.db.find(this.collection, filter);
  }
}
```

### ComponentLibraryDataSource

DataSource that wraps the backend Actor for Handle operations:

```javascript
class ComponentLibraryDataSource {
  constructor(backendActor) {
    this.backend = backendActor;
    this.cache = new Map(); // Simple cache
  }

  // REQUIRED: Synchronous query
  query(querySpec) {
    // For synchronous access, return cached data
    // Async operations happen via Handle methods
    if (querySpec.type === 'all') {
      return Array.from(this.cache.values());
    }
    if (querySpec.type === 'get' && querySpec.id) {
      return this.cache.get(querySpec.id);
    }
    return [];
  }

  // REQUIRED: Synchronous subscribe
  subscribe(querySpec, callback) {
    const subscriptionId = generateUUID();
    // Setup subscription logic
    return {
      id: subscriptionId,
      unsubscribe: () => { /* cleanup */ }
    };
  }

  // REQUIRED: Get schema
  getSchema() {
    return {
      type: 'ComponentLibrary',
      operations: ['create', 'read', 'update', 'delete', 'list', 'filter'],
      componentSchema: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        description: { type: 'string' },
        dsl: { type: 'string' },
        cnl: { type: 'string' },
        json: { type: 'object' },
        dataModel: { type: 'object' },
        tags: { type: 'array' },
        author: { type: 'string' }
      }
    };
  }

  // Async operations (called by Handle methods)
  async createComponent(data) {
    const component = await this.backend.send('component.create', data);
    this.cache.set(component.id, component);
    return component;
  }

  async getComponent(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    const component = await this.backend.send('component.get', { id });
    this.cache.set(id, component);
    return component;
  }

  async updateComponent(id, updates) {
    const component = await this.backend.send('component.update', { id, updates });
    this.cache.set(id, component);
    return component;
  }

  async deleteComponent(id) {
    await this.backend.send('component.delete', { id });
    this.cache.delete(id);
    return true;
  }

  async listComponents(filter = {}) {
    const results = await this.backend.send('component.list', { filter });
    results.forEach(c => this.cache.set(c.id, c));
    return results;
  }
}
```

## Live Preview System

### Preview Component Lifecycle

The preview pane uses the actual ComponentLifecycle to render components:

```javascript
class PreviewManager {
  constructor(dataStore) {
    this.lifecycle = new ComponentLifecycle(dataStore);
    this.currentComponent = null;
    this.container = null;
  }

  async renderPreview(dsl, sampleData, container) {
    // Unmount previous component
    if (this.currentComponent) {
      await this.currentComponent.unmount();
    }

    this.container = container;

    try {
      // Mount component with sample data
      this.currentComponent = await this.lifecycle.mount(dsl, container, sampleData);
      return { success: true };
    } catch (error) {
      // Show error in preview
      container.innerHTML = `
        <div class="preview-error">
          <h3>Preview Error</h3>
          <pre>${error.message}</pre>
          <div class="error-stack">${error.stack}</div>
        </div>
      `;
      return { success: false, error: error.message };
    }
  }

  async updateSampleData(newData) {
    if (this.currentComponent) {
      await this.currentComponent.update(newData);
    }
  }

  destroy() {
    if (this.currentComponent) {
      this.currentComponent.unmount();
    }
  }
}
```

### Sample Data Editor

Inline editor for modifying sample data used in preview:

```javascript
class SampleDataEditor {
  constructor(container, dataModel) {
    this.container = container;
    this.dataModel = dataModel;
    this.render();
  }

  render() {
    const schema = this.dataModel.schema;
    const sample = this.dataModel.sampleData;

    this.container.innerHTML = `
      <div class="sample-data-editor">
        <h4>Sample Data</h4>
        ${Object.entries(schema).map(([field, def]) => `
          <div class="sample-field">
            <label>${field}</label>
            <input
              type="${this.getInputType(def.type)}"
              name="${field}"
              value="${sample[field] || ''}"
              placeholder="${def.description || ''}"
            />
          </div>
        `).join('')}
      </div>
    `;
  }

  getInputType(schemaType) {
    const typeMap = {
      string: 'text',
      number: 'number',
      boolean: 'checkbox',
      date: 'date'
    };
    return typeMap[schemaType] || 'text';
  }

  getSampleData() {
    const inputs = this.container.querySelectorAll('input');
    const data = {};
    inputs.forEach(input => {
      data[input.name] = input.type === 'checkbox' ? input.checked : input.value;
    });
    return data;
  }

  onDataChange(callback) {
    this.container.addEventListener('input', () => {
      callback(this.getSampleData());
    });
  }
}
```

## Component Testing System

### Test Definition

Tests are stored with components and can be run on-demand:

```javascript
{
  tests: [
    {
      name: "should display user name",
      description: "Verify name appears in h2 element",
      data: {
        name: "Test User",
        avatar: "https://example.com/avatar.jpg",
        bio: "Test bio"
      },
      assertions: [
        {
          type: "element",
          selector: "h2.name",
          property: "textContent",
          operator: "equals",
          expected: "Test User"
        },
        {
          type: "element",
          selector: "img.avatar",
          property: "src",
          operator: "equals",
          expected: "https://example.com/avatar.jpg"
        },
        {
          type: "element",
          selector: ".profile-card",
          property: "classList",
          operator: "contains",
          expected: "profile-card"
        }
      ]
    }
  ]
}
```

### Test Runner

```javascript
class ComponentTestRunner {
  constructor(lifecycle) {
    this.lifecycle = lifecycle;
  }

  async runTests(dsl, tests) {
    const results = {
      total: tests.length,
      passed: 0,
      failed: 0,
      tests: []
    };

    for (const test of tests) {
      const result = await this.runTest(dsl, test);
      results.tests.push(result);
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  async runTest(dsl, test) {
    // Create temporary container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    try {
      // Mount component with test data
      const component = await this.lifecycle.mount(dsl, container, test.data);

      // Run assertions
      const assertionResults = [];
      for (const assertion of test.assertions) {
        const result = this.runAssertion(container, assertion);
        assertionResults.push(result);
      }

      // Cleanup
      await component.unmount();
      document.body.removeChild(container);

      // Check if all assertions passed
      const passed = assertionResults.every(r => r.passed);

      return {
        name: test.name,
        passed,
        assertions: assertionResults,
        message: passed ? 'All assertions passed' : 'Some assertions failed'
      };
    } catch (error) {
      // Test execution failed
      document.body.removeChild(container);
      return {
        name: test.name,
        passed: false,
        error: error.message,
        message: `Test failed: ${error.message}`
      };
    }
  }

  runAssertion(container, assertion) {
    const element = container.querySelector(assertion.selector);

    if (!element) {
      return {
        passed: false,
        message: `Element not found: ${assertion.selector}`
      };
    }

    const actualValue = this.getPropertyValue(element, assertion.property);
    const passed = this.compareValues(
      actualValue,
      assertion.expected,
      assertion.operator
    );

    return {
      passed,
      actual: actualValue,
      expected: assertion.expected,
      message: passed
        ? `✓ ${assertion.selector}.${assertion.property} ${assertion.operator} ${assertion.expected}`
        : `✗ Expected ${assertion.expected}, got ${actualValue}`
    };
  }

  getPropertyValue(element, property) {
    // Handle nested properties like "style.color"
    const parts = property.split('.');
    let value = element;
    for (const part of parts) {
      value = value[part];
    }
    return value;
  }

  compareValues(actual, expected, operator) {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return actual.includes(expected);
      case 'matches':
        return new RegExp(expected).test(actual);
      case 'greaterThan':
        return actual > expected;
      case 'lessThan':
        return actual < expected;
      default:
        return false;
    }
  }
}
```

## Integration with CLI Web Page

### Showing Component Editor in CLI

The component editor can be displayed via the `/show` command:

```javascript
// In CLI command handler
commands.register('component-editor', async (args) => {
  // Create component editor umbilical
  const umbilical = {
    dom: document.getElementById('cli-content'),
    backend: backendActor,
    componentStore: componentLibraryHandle,
    dataStore: cliDataStore,
    theme: 'dark',
    onComponentSaved: (component) => {
      console.log('Component saved:', component.name);
    }
  };

  // Create editor instance
  const editor = ComponentEditor.create(umbilical);

  // If component ID provided, load it
  if (args.componentId) {
    await editor.loadComponent(args.componentId);
  }

  return editor;
});

// Usage in CLI:
// > /show component-editor
// > /show component-editor component_123
```

### Component Browser in CLI

Browse and filter components from the CLI:

```javascript
commands.register('components', async (args) => {
  let components;

  if (args.tag) {
    components = await componentStore.byTag(args.tag);
  } else if (args.author) {
    components = await componentStore.byAuthor(args.author);
  } else {
    components = await componentStore.all();
  }

  return {
    type: 'component-list',
    components: components.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      tags: c.tags,
      modified: c.modified
    }))
  };
});

// Usage:
// > /components
// > /components tag="profile"
// > /components author="alice"
```

## AI Agent Integration

### AI-Friendly Component Creation

AI agents can create components programmatically:

```javascript
// AI agent creates component via Handle
const componentStore = await resourceManager.get('componentLibrary');

const newComponent = await componentStore.create({
  name: 'TaskListItem',
  description: 'A single task item with checkbox and text',
  cnl: `
    Define TaskListItem with task:
      A list item with class "task-item" containing:
        A checkbox bound to task completed
        A span showing task text
        A button labeled "Delete" that emits delete-requested on click
  `,
  dataModel: {
    entityName: 'task',
    schema: {
      text: { type: 'string', description: 'Task description' },
      completed: { type: 'boolean', description: 'Task completion status' }
    },
    sampleData: {
      text: 'Example task',
      completed: false
    }
  },
  author: 'ai',
  authorDetails: {
    type: 'ai',
    model: 'claude-sonnet-4.5',
    sessionId: 'session_123'
  },
  tags: ['task', 'list', 'todo']
});

// AI can then retrieve and modify
const component = await componentStore.get(newComponent.id);
component.description = 'Updated description';
await component.save();
```

### Collaborative Editing

Human and AI can edit the same component:

```javascript
// Human edits DSL
component.dsl = `
  TaskListItem :: task =>
    li.task-item [
      input[type=checkbox] { task.completed } <=> task.completed
      span.text { task.text }
      button.delete { "×" } => emit("delete-requested", task.id)
    ]
`;

// AI suggests improvements
const aiSuggestion = await aiAgent.improveComponent(component);
component.dsl = aiSuggestion.dsl;
component.author = 'collaborative';

await component.save();
```

## Component Categories and Organization

### Categorization System

Components can be organized by category, tags, and author:

```javascript
const categories = {
  'user-interface': ['profile', 'avatar', 'card'],
  'forms': ['input', 'button', 'select', 'validation'],
  'data-display': ['table', 'list', 'grid', 'chart'],
  'navigation': ['menu', 'tabs', 'breadcrumb', 'sidebar'],
  'feedback': ['alert', 'toast', 'modal', 'tooltip'],
  'layout': ['container', 'grid', 'flex', 'divider']
};

// Query by category
const formComponents = await componentStore.byCategory('forms');

// Query by tag
const profileComponents = await componentStore.byTag('profile');

// Client-side filtering for complex queries
const userProfileComponents = await componentStore.filter(c =>
  c.tags.includes('user') && c.tags.includes('profile')
);
```

### Component Templates

Pre-built component templates for common patterns:

```javascript
const templates = {
  'crud-list': {
    name: 'CRUD List Template',
    description: 'List with create, read, update, delete operations',
    dsl: `/* Template DSL */`,
    dataModel: {
      entityName: 'item',
      schema: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    }
  },
  'form-with-validation': {
    name: 'Form with Validation',
    description: 'Form with field validation and error display',
    dsl: `/* Template DSL */`,
    dataModel: { /* ... */ }
  }
};

// Create from template
const newComponent = await componentStore.createFromTemplate('crud-list', {
  name: 'UserList',
  entityName: 'user',
  fields: ['name', 'email', 'role']
});
```

## Summary

The Component Editor is a comprehensive MVVM component that:

1. **Represents components as Handles** - Structured data with rich object interface
2. **Stores components persistently** - Backend Actor with database persistence
3. **Provides multi-format editing** - DSL, CNL, JSON, and data model editors
4. **Enables live preview** - Real component rendering with sample data
5. **Supports testing** - Integrated test runner with assertions
6. **Facilitates browsing** - Component library with filtering and categorization
7. **Integrates with CLI** - Display in web page via `/show` command
8. **Enables AI collaboration** - Components as data for AI manipulation

This MVP focuses on core functionality without NFRs like performance optimization, advanced validation, version control, or collaborative real-time editing. The architecture is extensible for future enhancements while providing a complete, working system for component creation and management.
