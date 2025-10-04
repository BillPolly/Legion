/**
 * ComponentEditor Umbilical Interface Tests - Phase 5.4
 *
 * Tests for ComponentEditor.create() umbilical interface
 * Tests MVVM integration, validation, public API, and lifecycle
 */

import { ComponentEditor } from '../../../src/components/component-editor/index.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// In-memory database for testing
class InMemoryDatabase {
  constructor() {
    this.collections = new Map();
  }

  async insert(collection, data) {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }
    this.collections.get(collection).push(data);
    return data;
  }

  async findOne(collection, query) {
    if (!this.collections.has(collection)) {
      return null;
    }
    const items = this.collections.get(collection);
    return items.find(item => this._matches(item, query)) || null;
  }

  async find(collection, query = {}) {
    if (!this.collections.has(collection)) {
      return [];
    }
    const items = this.collections.get(collection);
    if (Object.keys(query).length === 0) {
      return [...items];
    }
    return items.filter(item => this._matches(item, query));
  }

  async update(collection, query, data) {
    if (!this.collections.has(collection)) {
      return null;
    }
    const items = this.collections.get(collection);
    const index = items.findIndex(item => this._matches(item, query));
    if (index === -1) {
      return null;
    }
    items[index] = data;
    return data;
  }

  async delete(collection, query) {
    if (!this.collections.has(collection)) {
      return false;
    }
    const items = this.collections.get(collection);
    const index = items.findIndex(item => this._matches(item, query));
    if (index === -1) {
      return false;
    }
    items.splice(index, 1);
    return true;
  }

  _matches(item, query) {
    return Object.entries(query).every(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        return this._matches(item[key], value);
      }
      return item[key] === value;
    });
  }

  clear() {
    this.collections.clear();
  }
}

describe('ComponentEditor Umbilical Interface', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'editor-container';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    componentStore = new ComponentLibraryHandle(dataSource);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('ComponentEditor.create() - Validation', () => {
    test('should require dom parameter', () => {
      expect(() => {
        ComponentEditor.create({
          componentStore,
        });
      }).toThrow(/dom.*required/i);
    });

    test('should require componentStore parameter', () => {
      expect(() => {
        ComponentEditor.create({
          dom: container,
        });
      }).toThrow(/componentStore.*required/i);
    });

    test('should accept minimal valid umbilical', () => {
      expect(() => {
        const editor = ComponentEditor.create({
          dom: container,
          componentStore,
        });
        editor.destroy();
      }).not.toThrow();
    });

    test('should accept optional theme parameter', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        theme: 'dark'
      });

      expect(editor).toBeDefined();
      editor.destroy();
    });

    test('should accept optional initial component parameter', async () => {
      const created = await componentStore.createComponent({
        name: 'Initial',
        dsl: 'Initial :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      expect(editor).toBeDefined();
      editor.destroy();
    });
  });

  describe('ComponentEditor.create() - MVVM Initialization', () => {
    test('should create Model, View, and ViewModel instances', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      // Should have created View in container
      expect(container.querySelector('.component-editor')).toBeTruthy();

      editor.destroy();
    });

    test('should render editor UI in container', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      // Check for main UI elements
      expect(container.querySelector('.editor-toolbar')).toBeTruthy();
      expect(container.querySelector('.browser-pane')).toBeTruthy();
      expect(container.querySelector('.editor-pane')).toBeTruthy();
      expect(container.querySelector('.preview-pane')).toBeTruthy();

      editor.destroy();
    });

    test('should apply theme to view', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        theme: 'dark'
      });

      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('dark')).toBe(true);

      editor.destroy();
    });

    test('should default to light theme', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('light')).toBe(true);

      editor.destroy();
    });
  });

  describe('ComponentEditor.create() - Initial Component Loading', () => {
    test('should load initial component if provided', async () => {
      const created = await componentStore.createComponent({
        name: 'LoadInitial',
        dsl: 'LoadInitial :: state => div { "Test" }',
        cnl: 'LoadInitial with state shows div with "Test"',
        json: { type: 'div', children: ['Test'] },
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      // Wait for async load
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check if content loaded into editors
      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('LoadInitial :: state => div { "Test" }');

      editor.destroy();
    });

    test('should not load anything if no initial component', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('');

      editor.destroy();
    });
  });

  describe('Public API Methods', () => {
    let editor;

    beforeEach(() => {
      editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });
    });

    afterEach(() => {
      if (editor) {
        editor.destroy();
      }
    });

    test('should expose loadComponent method', () => {
      expect(editor.loadComponent).toBeInstanceOf(Function);
    });

    test('should expose saveComponent method', () => {
      expect(editor.saveComponent).toBeInstanceOf(Function);
    });

    test('should expose deleteComponent method', () => {
      expect(editor.deleteComponent).toBeInstanceOf(Function);
    });

    test('should expose destroy method', () => {
      expect(editor.destroy).toBeInstanceOf(Function);
    });

    test('loadComponent should load component by ID', async () => {
      const created = await componentStore.createComponent({
        name: 'APILoad',
        dsl: 'APILoad :: s => span',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await editor.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('APILoad :: s => span');
    });

    test('saveComponent should save current editor content', async () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'SavedComponent :: state => div';
      dslEditor.dispatchEvent(new Event('input'));

      // Need to set dataModel manually (auto-extraction not implemented yet)
      // Access the model through the editor's internal structure
      // For now, we'll use a workaround - load a valid component first, then edit
      const created = await componentStore.createComponent({
        name: 'Initial',
        dsl: 'Initial :: state => div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await editor.loadComponent(created.id);

      // Now edit
      dslEditor.value = 'SavedComponent :: state => div';
      dslEditor.dispatchEvent(new Event('input'));

      const saved = await editor.saveComponent();

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.dsl).toBe('SavedComponent :: state => div');
    });

    test('deleteComponent should delete current component', async () => {
      const created = await componentStore.createComponent({
        name: 'ToDelete',
        dsl: 'ToDelete :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await editor.loadComponent(created.id);

      const result = await editor.deleteComponent();

      expect(result).toBe(true);

      // Verify deletion
      const found = await componentStore.getComponent(created.id);
      expect(found).toBeNull();
    });

    test('deleteComponent should return false when no component loaded', async () => {
      const result = await editor.deleteComponent();

      expect(result).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    test('should cleanup on destroy', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      editor.destroy();

      // Container should be cleared
      expect(container.querySelector('.component-editor')).toBeFalsy();
    });

    test('should not throw when destroying twice', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      editor.destroy();

      expect(() => editor.destroy()).not.toThrow();
    });

    test('should clear timeout on destroy', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      // Trigger a debounced update
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Test :: s => div';
      dslEditor.dispatchEvent(new Event('input'));

      editor.destroy();

      // Should not throw errors after destroy
      expect(() => editor.destroy()).not.toThrow();
    });
  });

  describe('Event Callbacks', () => {
    test('should call onComponentSaved callback when component saved', async () => {
      let savedComponent = null;
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        onComponentSaved: (component) => { savedComponent = component; }
      });

      // Load a valid component first
      const created = await componentStore.createComponent({
        name: 'Initial',
        dsl: 'Initial :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await editor.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Callback :: s => div';
      dslEditor.dispatchEvent(new Event('input'));

      await editor.saveComponent();

      expect(savedComponent).toBeDefined();
      expect(savedComponent.dsl).toBe('Callback :: s => div');

      editor.destroy();
    });

    test('should call onComponentDeleted callback when component deleted', async () => {
      let deletedId = null;
      const created = await componentStore.createComponent({
        name: 'DeleteCallback',
        dsl: 'DeleteCallback :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        onComponentDeleted: (id) => { deletedId = id; }
      });

      await editor.loadComponent(created.id);
      await editor.deleteComponent();

      expect(deletedId).toBe(created.id);

      editor.destroy();
    });

    test('should call onClose callback when editor destroyed', () => {
      let closeCalled = false;
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        onClose: () => { closeCalled = true; }
      });

      editor.destroy();

      expect(closeCalled).toBe(true);
    });
  });
});
