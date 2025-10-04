/**
 * Editor Integration Tests - Phase 5.5
 *
 * End-to-end tests for complete ComponentEditor workflows
 * Tests MVVM integration, editing sessions, format conversion, validation, and lifecycle
 * Uses real components via umbilical interface (NO MOCKS)
 */

import { ComponentEditor } from '../../../src/components/component-editor/index.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// Real InMemoryDatabase for integration testing
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

describe('Editor Integration Tests - Phase 5.5', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'editor-integration-test';
    document.body.appendChild(container);

    // Create backend stack (NO MOCKS)
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

  describe('Creating Editor via Umbilical', () => {
    test('should create functional editor with minimal umbilical', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      // Should render complete UI
      expect(container.querySelector('.component-editor')).toBeTruthy();
      expect(container.querySelector('.editor-toolbar')).toBeTruthy();
      expect(container.querySelector('.browser-pane')).toBeTruthy();
      expect(container.querySelector('.editor-pane')).toBeTruthy();
      expect(container.querySelector('.preview-pane')).toBeTruthy();

      editor.destroy();
    });

    test('should create editor with theme applied', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        theme: 'dark'
      });

      const editorRoot = container.querySelector('.component-editor');
      expect(editorRoot.classList.contains('dark')).toBe(true);

      editor.destroy();
    });

    test('should create editor with initial component loaded', async () => {
      const created = await componentStore.createComponent({
        name: 'InitialLoad',
        dsl: 'InitialLoad :: state => div { "Initial" }',
        cnl: 'InitialLoad with state shows div with "Initial"',
        json: { type: 'div', children: ['Initial'] },
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

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('InitialLoad :: state => div { "Initial" }');

      editor.destroy();
    });
  });

  describe('Complete Editing Session', () => {
    test('should handle workflow: create editor → edit → save → destroy', async () => {
      // 1. Create editor
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      expect(container.querySelector('.component-editor')).toBeTruthy();

      // 2. Load a component
      const created = await componentStore.createComponent({
        name: 'EditMe',
        dsl: 'EditMe :: state => div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await editor.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe('EditMe :: state => div');

      // 3. Edit the component
      dslEditor.value = 'EditMe :: state => span { "Edited" }';
      dslEditor.dispatchEvent(new Event('input'));

      // Wait for auto-conversion
      await new Promise(resolve => setTimeout(resolve, 50));

      // 4. Save
      const saved = await editor.saveComponent();

      expect(saved.dsl).toBe('EditMe :: state => span { "Edited" }');
      expect(saved.version).toBe(2); // Incremented version

      // 5. Destroy
      editor.destroy();

      expect(container.querySelector('.component-editor')).toBeFalsy();
    });

    test('should handle workflow: load → edit → convert → validate → save', async () => {
      const created = await componentStore.createComponent({
        name: 'ConvertTest',
        dsl: 'ConvertTest :: state => div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      // Wait for load
      await new Promise(resolve => setTimeout(resolve, 50));

      // Edit DSL
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'ConvertTest :: state => span { state.message }';
      dslEditor.dispatchEvent(new Event('input'));

      // Wait for auto-conversion
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify CNL was auto-generated
      const cnlEditor = container.querySelector('.editor-cnl');
      expect(cnlEditor.value.length).toBeGreaterThan(0);

      // Verify JSON was auto-generated
      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value.length).toBeGreaterThan(0);

      // Verify validation status shows valid
      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus.classList.contains('valid')).toBe(true);

      // Save
      const saved = await editor.saveComponent();

      expect(saved.dsl).toBe('ConvertTest :: state => span { state.message }');
      expect(saved.cnl).toBeDefined();
      expect(saved.json).toBeDefined();

      editor.destroy();
    });

    test('should handle workflow with validation errors', async () => {
      const created = await componentStore.createComponent({
        name: 'ValidateTest',
        dsl: 'ValidateTest :: state => div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Enter invalid DSL
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'InvalidDSL without proper structure';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify validation status shows errors
      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus.classList.contains('invalid')).toBe(true);
      expect(validationStatus.textContent).toContain('error');

      // Attempt to save - should fail
      await expect(editor.saveComponent()).rejects.toThrow(/Validation failed/);

      // Fix the DSL
      dslEditor.value = 'ValidateTest :: state => span';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Validation should pass now
      expect(validationStatus.classList.contains('valid')).toBe(true);

      // Save should succeed
      const saved = await editor.saveComponent();
      expect(saved.dsl).toBe('ValidateTest :: state => span');

      editor.destroy();
    });
  });

  describe('Format Conversion During Editing', () => {
    test('should auto-convert DSL to CNL and JSON on edit', async () => {
      const created = await componentStore.createComponent({
        name: 'AutoConvert',
        dsl: 'AutoConvert :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Edit DSL
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'AutoConvert :: s => span { "New" }';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // CNL should be auto-updated
      const cnlEditor = container.querySelector('.editor-cnl');
      expect(cnlEditor.value).toBeDefined();
      expect(cnlEditor.value.length).toBeGreaterThan(0);

      // JSON should be auto-updated
      const jsonEditor = container.querySelector('.editor-json');
      const json = JSON.parse(jsonEditor.value);
      expect(json.type).toBe('span');

      editor.destroy();
    });

    test('should auto-convert CNL to DSL and JSON on edit', async () => {
      const created = await componentStore.createComponent({
        name: 'CNLConvert',
        cnl: 'CNLConvert with state shows div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Edit CNL
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'CNLConvert with state shows span';
      cnlEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // DSL should be auto-updated
      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBeDefined();
      expect(dslEditor.value.length).toBeGreaterThan(0);

      // JSON should be auto-updated
      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value.length).toBeGreaterThan(0);

      editor.destroy();
    });

    test('should persist all formats on save', async () => {
      const created = await componentStore.createComponent({
        name: 'PersistFormats',
        dsl: 'PersistFormats :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Edit DSL (triggers auto-conversion)
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'PersistFormats :: s => p { "Text" }';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Save
      const saved = await editor.saveComponent();

      // All formats should be persisted
      expect(saved.dsl).toBe('PersistFormats :: s => p { "Text" }');
      expect(saved.cnl).toBeDefined();
      expect(saved.json).toBeDefined();

      // Verify in database
      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.dsl).toBe('PersistFormats :: s => p { "Text" }');
      expect(fromDb.cnl).toBeDefined();
      expect(fromDb.json).toBeDefined();

      editor.destroy();
    });
  });

  describe('Component Lifecycle', () => {
    test('should handle delete workflow', async () => {
      const created = await componentStore.createComponent({
        name: 'DeleteMe',
        dsl: 'DeleteMe :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        initialComponent: created.id
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Delete
      const result = await editor.deleteComponent();

      expect(result).toBe(true);

      // Verify deletion from database
      const found = await database.findOne('components', { id: created.id });
      expect(found).toBeNull();

      editor.destroy();
    });

    test('should handle multiple components in same session', async () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      // Create first component
      const comp1 = await componentStore.createComponent({
        name: 'Component1',
        dsl: 'Component1 :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Load and edit first
      await editor.loadComponent(comp1.id);

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Component1 :: s => span';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      await editor.saveComponent();

      // Create second component
      const comp2 = await componentStore.createComponent({
        name: 'Component2',
        dsl: 'Component2 :: s => p',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Load and edit second
      await editor.loadComponent(comp2.id);

      dslEditor.value = 'Component2 :: s => strong';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      await editor.saveComponent();

      // Verify both in database
      const all = await database.find('components', {});
      expect(all.length).toBe(2);

      const db1 = await database.findOne('components', { id: comp1.id });
      expect(db1.dsl).toBe('Component1 :: s => span');

      const db2 = await database.findOne('components', { id: comp2.id });
      expect(db2.dsl).toBe('Component2 :: s => strong');

      editor.destroy();
    });
  });

  describe('Event Callbacks', () => {
    test('should trigger onComponentSaved callback', async () => {
      let savedCalled = false;
      let savedComponent = null;

      const created = await componentStore.createComponent({
        name: 'SaveCallback',
        dsl: 'SaveCallback :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        onComponentSaved: (component) => {
          savedCalled = true;
          savedComponent = component;
        }
      });

      await editor.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'SaveCallback :: s => span';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 50));

      await editor.saveComponent();

      expect(savedCalled).toBe(true);
      expect(savedComponent).toBeDefined();
      expect(savedComponent.dsl).toBe('SaveCallback :: s => span');

      editor.destroy();
    });

    test('should trigger onComponentDeleted callback', async () => {
      let deletedCalled = false;
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
        onComponentDeleted: (id) => {
          deletedCalled = true;
          deletedId = id;
        }
      });

      await editor.loadComponent(created.id);
      await editor.deleteComponent();

      expect(deletedCalled).toBe(true);
      expect(deletedId).toBe(created.id);

      editor.destroy();
    });

    test('should trigger onClose callback on destroy', () => {
      let closeCalled = false;

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        onClose: () => {
          closeCalled = true;
        }
      });

      editor.destroy();

      expect(closeCalled).toBe(true);
    });
  });

  describe('Editor Destruction and Cleanup', () => {
    test('should cleanup DOM on destroy', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      expect(container.querySelector('.component-editor')).toBeTruthy();

      editor.destroy();

      expect(container.querySelector('.component-editor')).toBeFalsy();
    });

    test('should prevent operations after destroy', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      editor.destroy();

      expect(() => editor.loadComponent('some-id')).rejects.toThrow(/destroyed/);
      expect(() => editor.saveComponent()).rejects.toThrow(/destroyed/);
      expect(() => editor.deleteComponent()).rejects.toThrow(/destroyed/);
    });

    test('should handle double destroy gracefully', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
      });

      editor.destroy();

      expect(() => editor.destroy()).not.toThrow();
    });
  });
});
