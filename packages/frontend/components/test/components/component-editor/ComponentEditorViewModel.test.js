/**
 * ComponentEditorViewModel Tests - Phase 5.2
 *
 * Tests for ComponentEditorViewModel coordination of Model and View layers
 * Tests event handling, data flow, and MVVM integration
 */

import { ComponentEditorViewModel } from '../../../src/components/component-editor/src/viewmodel/ComponentEditorViewModel.js';
import { ComponentEditorModel } from '../../../src/components/component-editor/src/model/ComponentEditorModel.js';
import { ComponentEditorView } from '../../../src/components/component-editor/src/view/ComponentEditorView.js';
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

describe('ComponentEditorViewModel', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let handle;
  let model;
  let view;
  let viewModel;

  beforeEach(() => {
    // Create DOM container for View
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    handle = new ComponentLibraryHandle(dataSource);

    // Create Model and View
    model = new ComponentEditorModel({ componentStore: handle });
    view = new ComponentEditorView({ dom: container });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('Constructor', () => {
    test('should create ViewModel with Model and View', () => {
      viewModel = new ComponentEditorViewModel({ model, view });

      expect(viewModel).toBeInstanceOf(ComponentEditorViewModel);
      expect(viewModel.model).toBe(model);
      expect(viewModel.view).toBe(view);
    });

    test('should initialize preview tracking variables', () => {
      viewModel = new ComponentEditorViewModel({ model, view });

      expect(viewModel.previewTimeout).toBeUndefined();
    });

    test('should call setupEventHandlers on construction', () => {
      // Mock setupEventHandlers
      const originalSetup = ComponentEditorViewModel.prototype.setupEventHandlers;
      let setupCalled = false;
      ComponentEditorViewModel.prototype.setupEventHandlers = function() {
        setupCalled = true;
      };

      viewModel = new ComponentEditorViewModel({ model, view });

      expect(setupCalled).toBe(true);

      // Restore
      ComponentEditorViewModel.prototype.setupEventHandlers = originalSetup;
    });
  });

  describe('setupEventHandlers()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should attach Save button handler', () => {
      let handleSaveCalled = false;
      viewModel.handleSave = () => { handleSaveCalled = true; };

      // Re-setup to use mocked handler
      viewModel.setupEventHandlers();

      const saveBtn = container.querySelector('.btn-save');
      saveBtn.click();

      expect(handleSaveCalled).toBe(true);
    });

    test('should attach Test button handler', () => {
      let handleTestCalled = false;
      viewModel.handleTest = () => { handleTestCalled = true; };

      viewModel.setupEventHandlers();

      const testBtn = container.querySelector('.btn-test');
      testBtn.click();

      expect(handleTestCalled).toBe(true);
    });

    test('should attach format selector handler', () => {
      let selectedFormat = null;
      viewModel.handleFormatChange = (format) => { selectedFormat = format; };

      viewModel.setupEventHandlers();

      const selector = container.querySelector('.format-selector');
      selector.value = 'cnl';
      selector.dispatchEvent(new Event('change'));

      expect(selectedFormat).toBe('cnl');
    });

    test('should attach DSL editor change handler', () => {
      let dslChanged = false;
      viewModel.handleDSLChange = () => { dslChanged = true; };

      viewModel.setupEventHandlers();

      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.dispatchEvent(new Event('input'));

      expect(dslChanged).toBe(true);
    });

    test('should attach CNL editor change handler', () => {
      let cnlChanged = false;
      viewModel.handleCNLChange = () => { cnlChanged = true; };

      viewModel.setupEventHandlers();

      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.dispatchEvent(new Event('input'));

      expect(cnlChanged).toBe(true);
    });

    test('should attach JSON editor change handler', () => {
      let jsonChanged = false;
      viewModel.handleJSONChange = () => { jsonChanged = true; };

      viewModel.setupEventHandlers();

      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.dispatchEvent(new Event('input'));

      expect(jsonChanged).toBe(true);
    });

    test('should attach component selection handler', async () => {
      // Create test component
      const created = await handle.createComponent({
        name: 'Test',
        dsl: 'Test :: s => div',
        tags: ['test'],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      let loadedId = null;
      viewModel.loadComponent = (id) => { loadedId = id; };

      viewModel.setupEventHandlers();

      // Render component list
      view.renderComponentList([created]);

      const item = container.querySelector('.component-item');
      item.click();

      expect(loadedId).toBe(created.id);
    });
  });

  describe('loadComponent()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should load component into model', async () => {
      const created = await handle.createComponent({
        name: 'TestLoad',
        dsl: 'TestLoad :: state => div { "Test" }',
        cnl: 'TestLoad with state shows div with "Test"',
        json: { type: 'div', children: ['Test'] },
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponent(created.id);

      expect(model.currentComponent.id).toBe(created.id);
      expect(model.dslContent).toBe('TestLoad :: state => div { "Test" }');
    });

    test('should update view with component content', async () => {
      const created = await handle.createComponent({
        name: 'ViewUpdate',
        dsl: 'ViewUpdate :: s => span',
        cnl: 'ViewUpdate with s shows span',
        json: { type: 'span' },
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponent(created.id);

      const dslEditor = container.querySelector('.editor-dsl');
      const cnlEditor = container.querySelector('.editor-cnl');
      const jsonEditor = container.querySelector('.editor-json');

      expect(dslEditor.value).toBe('ViewUpdate :: s => span');
      expect(cnlEditor.value).toBe('ViewUpdate with s shows span');
      expect(jsonEditor.value).toContain('"type"');
      expect(jsonEditor.value).toContain('"span"');
    });

    test('should format JSON content with indentation', async () => {
      const created = await handle.createComponent({
        name: 'JSONFormat',
        dsl: 'JSONFormat :: s => div',
        json: { type: 'div', props: { className: 'test' } },
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponent(created.id);

      const jsonEditor = container.querySelector('.editor-json');

      // Should have line breaks (formatted)
      expect(jsonEditor.value).toContain('\n');
      expect(jsonEditor.value).toContain('  '); // Indentation
    });
  });

  describe('handleSave()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should save component via model', async () => {
      model.dslContent = 'SaveTest :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };

      await viewModel.handleSave();

      expect(model.currentComponent).toBeDefined();
      expect(model.currentComponent.id).toBeDefined();
    });

    test('should clear dirty state after save', async () => {
      model.dslContent = 'DirtyTest :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      model.isDirty = true;

      await viewModel.handleSave();

      expect(model.isDirty).toBe(false);
    });

    test('should throw error when save fails validation', async () => {
      // Set invalid content (missing entityName)
      model.dslContent = 'Invalid';
      model.dataModelContent = {};

      // Should throw validation error
      await expect(viewModel.handleSave()).rejects.toThrow(/Validation failed/);
    });
  });

  describe('handleFormatChange()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should update active format in model', () => {
      viewModel.handleFormatChange('cnl');

      expect(model.activeFormat).toBe('cnl');
    });

    test('should accept all valid formats', () => {
      viewModel.handleFormatChange('dsl');
      expect(model.activeFormat).toBe('dsl');

      viewModel.handleFormatChange('cnl');
      expect(model.activeFormat).toBe('cnl');

      viewModel.handleFormatChange('json');
      expect(model.activeFormat).toBe('json');

      viewModel.handleFormatChange('dataModel');
      expect(model.activeFormat).toBe('dataModel');
    });
  });

  describe('handleDSLChange()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should read DSL content from view', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Updated :: s => span';

      viewModel.handleDSLChange();

      expect(model.dslContent).toBe('Updated :: s => span');
    });

    test('should mark model as dirty', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Changed :: s => div';

      viewModel.handleDSLChange();

      expect(model.isDirty).toBe(true);
    });

    test('should auto-convert DSL to CNL', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'AutoConvert :: state => div';

      viewModel.handleDSLChange();

      expect(model.cnlContent).toBeDefined();
      expect(model.cnlContent.length).toBeGreaterThan(0);
    });

    test('should auto-convert DSL to JSON', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'ToJSON :: s => span';

      viewModel.handleDSLChange();

      expect(model.jsonContent).toBeDefined();
      expect(typeof model.jsonContent).toBe('object');
    });

    test('should update CNL editor view', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Sync :: s => div';

      viewModel.handleDSLChange();

      const cnlEditor = container.querySelector('.editor-cnl');
      expect(cnlEditor.value).toBe(model.cnlContent);
    });

    test('should update JSON editor view', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'JSONSync :: s => span';

      viewModel.handleDSLChange();

      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value.length).toBeGreaterThan(0);
    });

    test('should validate content after change', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Invalid DSL without proper format';

      viewModel.handleDSLChange();

      expect(model.validationErrors.length).toBeGreaterThan(0);
    });

    test('should show validation errors in view', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Bad';

      viewModel.handleDSLChange();

      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus.classList.contains('invalid')).toBe(true);
    });

    test('should debounce preview update', () => {
      const dslEditor = container.querySelector('.editor-dsl');
      dslEditor.value = 'Debounce :: s => div';

      viewModel.handleDSLChange();

      expect(viewModel.previewTimeout).toBeDefined();
    });
  });

  describe('handleCNLChange()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should read CNL content from view', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'Test with state shows div';

      viewModel.handleCNLChange();

      expect(model.cnlContent).toBe('Test with state shows div');
    });

    test('should mark model as dirty', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'Changed with s shows span';

      viewModel.handleCNLChange();

      expect(model.isDirty).toBe(true);
    });

    test('should auto-convert CNL to DSL', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'AutoConvert with state shows div';

      viewModel.handleCNLChange();

      expect(model.dslContent).toBeDefined();
      expect(model.dslContent.length).toBeGreaterThan(0);
    });

    test('should auto-convert CNL to JSON', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'ToJSON with s shows span';

      viewModel.handleCNLChange();

      expect(model.jsonContent).toBeDefined();
      expect(typeof model.jsonContent).toBe('object');
    });

    test('should update DSL editor view', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'Sync with s shows div';

      viewModel.handleCNLChange();

      const dslEditor = container.querySelector('.editor-dsl');
      expect(dslEditor.value).toBe(model.dslContent);
    });

    test('should update JSON editor view', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'JSONSync with s shows span';

      viewModel.handleCNLChange();

      const jsonEditor = container.querySelector('.editor-json');
      expect(jsonEditor.value.length).toBeGreaterThan(0);
    });

    test('should debounce preview update', () => {
      const cnlEditor = container.querySelector('.editor-cnl');
      cnlEditor.value = 'Debounce with s shows div';

      viewModel.handleCNLChange();

      expect(viewModel.previewTimeout).toBeDefined();
    });
  });

  describe('handleJSONChange()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should read JSON content from view', () => {
      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.value = '{"type": "div"}';

      viewModel.handleJSONChange();

      expect(model.jsonContent).toEqual({ type: 'div' });
    });

    test('should mark model as dirty', () => {
      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.value = '{"type": "span"}';

      viewModel.handleJSONChange();

      expect(model.isDirty).toBe(true);
    });

    test('should handle invalid JSON gracefully', () => {
      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.value = 'not valid json';

      expect(() => viewModel.handleJSONChange()).not.toThrow();
    });

    test('should debounce preview update', () => {
      const jsonEditor = container.querySelector('.editor-json');
      jsonEditor.value = '{"type": "div"}';

      viewModel.handleJSONChange();

      expect(viewModel.previewTimeout).toBeDefined();
    });
  });

  describe('debouncePreviewUpdate()', () => {
    beforeEach(() => {
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    test('should set timeout for preview update', () => {
      viewModel.debouncePreviewUpdate();

      expect(viewModel.previewTimeout).toBeDefined();
    });

    test('should clear previous timeout', () => {
      viewModel.debouncePreviewUpdate();
      const firstTimeout = viewModel.previewTimeout;

      viewModel.debouncePreviewUpdate();
      const secondTimeout = viewModel.previewTimeout;

      expect(secondTimeout).not.toBe(firstTimeout);
    });

    test('should delay preview update by 500ms', (done) => {
      let updateCalled = false;
      viewModel.updatePreview = () => { updateCalled = true; };

      viewModel.debouncePreviewUpdate();

      // Should not be called immediately
      expect(updateCalled).toBe(false);

      // Should be called after 500ms
      setTimeout(() => {
        expect(updateCalled).toBe(true);
        done();
      }, 600);
    });

    test('should cancel previous update on rapid changes', (done) => {
      let updateCount = 0;
      viewModel.updatePreview = () => { updateCount++; };

      // Rapid changes
      viewModel.debouncePreviewUpdate();
      setTimeout(() => viewModel.debouncePreviewUpdate(), 100);
      setTimeout(() => viewModel.debouncePreviewUpdate(), 200);
      setTimeout(() => viewModel.debouncePreviewUpdate(), 300);

      // Only last update should execute
      setTimeout(() => {
        expect(updateCount).toBe(1);
        done();
      }, 900);
    });
  });

  describe('handleTest()', () => {
    let backend;

    beforeEach(() => {
      // Create backend stack for testing
      database = new InMemoryDatabase();
      actor = new ComponentStoreActor(database);
      dataSource = new ComponentLibraryDataSource(actor);
      handle = new ComponentLibraryHandle(dataSource);
      backend = null;

      model = new ComponentEditorModel({ componentStore: handle, backend });
      view = new ComponentEditorView({ dom: container });
      viewModel = new ComponentEditorViewModel({ model, view });
    });

    afterEach(() => {
      database.clear();
    });

    test('should run tests when component has tests defined', async () => {
      // Create component with tests
      const component = await handle.createComponent({
        name: 'TestableComponent',
        dsl: 'UserCard :: user => div { h2 { user.name } }',
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
        },
        tests: [
          {
            name: 'should display user name',
            data: { name: 'Test User' },
            assertions: [
              {
                selector: 'h2',
                property: 'textContent',
                operator: 'equals',
                expected: 'Test User'
              }
            ]
          }
        ]
      });

      await viewModel.loadComponent(component.id);

      // Spy on view.showTestResults
      let resultsShown = null;
      viewModel.view.showTestResults = (results) => {
        resultsShown = results;
      };

      await viewModel.handleTest();

      expect(resultsShown).toBeTruthy();
      expect(resultsShown.total).toBeGreaterThan(0);
    });

    test('should handle components with no tests', async () => {
      const component = await handle.createComponent({
        name: 'NoTests',
        dsl: 'Simple :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponent(component.id);

      let resultsShown = null;
      viewModel.view.showTestResults = (results) => {
        resultsShown = results;
      };

      await viewModel.handleTest();

      expect(resultsShown).toBeTruthy();
      expect(resultsShown.total).toBe(0);
    });

    test('should handle test errors gracefully', async () => {
      const component = await handle.createComponent({
        name: 'ErrorComponent',
        dsl: 'Error :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        tests: [
          {
            name: 'failing test',
            data: {},
            assertions: [
              {
                selector: '.missing',
                property: 'textContent',
                operator: 'equals',
                expected: 'value'
              }
            ]
          }
        ]
      });

      await viewModel.loadComponent(component.id);

      let resultsShown = null;
      viewModel.view.showTestResults = (results) => {
        resultsShown = results;
      };

      await viewModel.handleTest();

      expect(resultsShown).toBeTruthy();
      expect(resultsShown.failed).toBeGreaterThan(0);
    });
  });
});
