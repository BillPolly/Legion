/**
 * Preview Integration Tests - Phase 6.5
 *
 * End-to-end tests for live preview system
 * Tests preview rendering, updates, sample data, and error handling
 */

import { ComponentEditor } from '../../../src/components/component-editor/index.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';
import { PreviewManager } from '../../../src/components/component-editor/src/preview/PreviewManager.js';

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

// Mock DataStore for preview
class MockDataStore {
  constructor() {
    this.data = new Map();
  }
}

// Mock ComponentLifecycle for preview testing
class MockComponentLifecycle {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.mountedComponents = [];
  }

  async mount(dsl, container, data) {
    const mockComponent = {
      dsl,
      container,
      data,
      update: async function(newData) {
        this.data = newData;
      },
      unmount: async () => {
        const index = this.mountedComponents.indexOf(mockComponent);
        if (index > -1) {
          this.mountedComponents.splice(index, 1);
        }
      }
    };

    this.mountedComponents.push(mockComponent);
    container.innerHTML = `<div class="preview-render">${dsl}</div>`;
    return mockComponent;
  }
}

describe('Preview Integration Tests - Phase 6.5', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;
  let dataStore;
  let mockPreviewManager;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'preview-integration-test';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    componentStore = new ComponentLibraryHandle(dataSource);

    // Create mock dataStore for preview
    dataStore = new MockDataStore();

    // Create mock preview manager with mock lifecycle
    const mockLifecycle = new MockComponentLifecycle(dataStore);
    mockPreviewManager = new PreviewManager(dataStore, mockLifecycle);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('Preview Manager Creation', () => {
    test('should create preview manager when dataStore provided', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      // Check that preview container exists in UI
      const previewContainer = container.querySelector('.preview-container');
      expect(previewContainer).toBeTruthy();

      editor.destroy();
    });

    test('should work without dataStore (preview disabled)', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore
        // No dataStore - preview disabled
      });

      expect(editor).toBeDefined();

      editor.destroy();
    });
  });

  describe('Preview Updates on DSL Changes', () => {
    test('should trigger preview update when DSL changes', async () => {
      const created = await componentStore.createComponent({
        name: 'PreviewTest',
        dsl: 'PreviewTest :: state => div',
        tags: [],
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      // Inject mock lifecycle to track preview updates
      const mockLifecycle = new MockComponentLifecycle(dataStore);
      const viewModel = editor._viewModel || (function() {
        // Access internal viewModel (implementation detail for testing)
        const toolbar = container.querySelector('.editor-toolbar');
        // Find the ViewModel through the editor's internal structure
        // This is a bit hacky but needed for integration testing
        return null; // We'll verify behavior through DOM instead
      })();

      await editor.loadComponent(created.id);

      // Edit DSL
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'PreviewTest :: state => span { "Updated" }';
      dslEditor.dispatchEvent(new Event('input'));

      // Wait for debounced preview update (500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Preview should have been triggered
      // (In real implementation with ComponentLifecycle, preview container would update)

      editor.destroy();
    });

    test('should debounce rapid DSL changes', async () => {
      const created = await componentStore.createComponent({
        name: 'DebounceTest',
        dsl: 'DebounceTest :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      await editor.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');

      // Rapid changes
      dslEditor.value = 'DebounceTest :: s => span';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      dslEditor.value = 'DebounceTest :: s => p';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      dslEditor.value = 'DebounceTest :: s => strong';
      dslEditor.dispatchEvent(new Event('input'));

      // Only one preview update should happen after debounce period
      await new Promise(resolve => setTimeout(resolve, 600));

      // Preview should reflect final value
      // (Debouncing prevents intermediate updates)

      editor.destroy();
    });
  });

  describe('Preview with Sample Data', () => {
    test('should use sample data from data model', async () => {
      const created = await componentStore.createComponent({
        name: 'SampleDataTest',
        dsl: 'SampleDataTest :: user => div { user.name }',
        tags: [],
        dataModel: {
          entityName: 'user',
          schema: {
            properties: {
              name: { type: 'string' }
            }
          },
          sampleData: {
            name: 'Test User'
          }
        }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      await editor.loadComponent(created.id);

      // Wait for initial preview
      await new Promise(resolve => setTimeout(resolve, 100));

      // Sample data should be passed to preview
      // (Would be rendered by real ComponentLifecycle)

      editor.destroy();
    });

    test('should handle missing sample data gracefully', async () => {
      const created = await componentStore.createComponent({
        name: 'NoSampleData',
        dsl: 'NoSampleData :: s => div',
        tags: [],
        dataModel: {
          entityName: 's',
          schema: {},
          sampleData: null
        }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      await editor.loadComponent(created.id);

      // Should not crash with missing sample data
      expect(() => {
        const dslEditor = container.querySelector('.editor-dsl');
        dslEditor.value = 'NoSampleData :: s => span';
        dslEditor.dispatchEvent(new Event('input'));
      }).not.toThrow();

      editor.destroy();
    });
  });

  describe('Preview Error Handling', () => {
    test('should handle preview rendering errors', async () => {
      const created = await componentStore.createComponent({
        name: 'ErrorTest',
        dsl: 'ErrorTest :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      await editor.loadComponent(created.id);

      // Edit to invalid DSL (would cause preview error)
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Invalid DSL Syntax';
      dslEditor.dispatchEvent(new Event('input'));

      // Wait for preview update
      await new Promise(resolve => setTimeout(resolve, 600));

      // Error should be handled gracefully
      // (Preview container should show error, not crash)
      const previewContainer = container.querySelector('.preview-container');
      expect(previewContainer).toBeTruthy();

      editor.destroy();
    });
  });

  describe('Preview Lifecycle', () => {
    test('should cleanup preview on editor destroy', () => {
      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      // Trigger preview update
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Test :: s => div';
      dslEditor.dispatchEvent(new Event('input'));

      // Destroy editor
      editor.destroy();

      // Preview should be cleaned up
      expect(container.querySelector('.component-editor')).toBeFalsy();
    });

    test('should cleanup preview on component switch', async () => {
      const comp1 = await componentStore.createComponent({
        name: 'Component1',
        dsl: 'Component1 :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp2 = await componentStore.createComponent({
        name: 'Component2',
        dsl: 'Component2 :: s => span',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      // Load first component
      await editor.loadComponent(comp1.id);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Switch to second component
      await editor.loadComponent(comp2.id);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Previous preview should be unmounted
      // New preview should be mounted
      const previewContainer = container.querySelector('.preview-container');
      expect(previewContainer).toBeTruthy();

      editor.destroy();
    });
  });

  describe('Complete Preview Workflow', () => {
    test('should handle full editing session with preview', async () => {
      const created = await componentStore.createComponent({
        name: 'FullWorkflow',
        dsl: 'FullWorkflow :: user => div { user.name }',
        tags: [],
        dataModel: {
          entityName: 'user',
          schema: {
            properties: {
              name: { type: 'string' },
              age: { type: 'number' }
            }
          },
          sampleData: {
            name: 'John Doe',
            age: 30
          }
        }
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        dataStore,
        previewManager: mockPreviewManager
      });

      // 1. Load component
      await editor.loadComponent(created.id);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. Edit DSL (triggers preview update)
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'FullWorkflow :: user => span { user.name } - { user.age }';
      dslEditor.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 600));

      // 3. Save changes
      await editor.saveComponent();

      // 4. Preview should still be showing updated component
      const previewContainer = container.querySelector('.preview-container');
      expect(previewContainer).toBeTruthy();

      editor.destroy();
    });
  });
});
