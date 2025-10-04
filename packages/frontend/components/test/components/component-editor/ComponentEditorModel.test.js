/**
 * ComponentEditorModel Tests - Phase 3.2
 *
 * Tests for ComponentEditorModel business logic
 * Manages component editing state, format conversions, and validation
 */

import { ComponentEditorModel } from '../../../src/components/component-editor/src/model/ComponentEditorModel.js';

// Mock ComponentLibraryHandle for testing
class MockComponentLibraryHandle {
  constructor() {
    this.components = new Map();
    this.nextId = 1;
  }

  async createComponent(componentData) {
    const id = `comp_${this.nextId++}`;
    const component = {
      id,
      ...componentData,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1
    };
    this.components.set(id, component);
    return component;
  }

  async getComponent(componentId) {
    return this.components.get(componentId) || null;
  }

  async updateComponent(componentId, updates) {
    const existing = this.components.get(componentId);
    if (!existing) {
      throw new Error('Component not found');
    }
    const updated = {
      ...existing,
      ...updates,
      modified: new Date().toISOString(),
      version: existing.version + 1
    };
    this.components.set(componentId, updated);
    return updated;
  }

  async deleteComponent(componentId) {
    return this.components.delete(componentId);
  }
}

describe('ComponentEditorModel', () => {
  let componentStore;
  let model;

  beforeEach(() => {
    componentStore = new MockComponentLibraryHandle();
    model = new ComponentEditorModel({ componentStore });
  });

  describe('Constructor', () => {
    test('should create model with componentStore', () => {
      expect(model).toBeInstanceOf(ComponentEditorModel);
      expect(model.componentStore).toBe(componentStore);
    });

    test('should initialize with no current component', () => {
      expect(model.currentComponent).toBeNull();
    });

    test('should initialize as not dirty', () => {
      expect(model.isDirty).toBe(false);
    });

    test('should initialize with DSL as active format', () => {
      expect(model.activeFormat).toBe('dsl');
    });

    test('should initialize with empty content', () => {
      expect(model.dslContent).toBe('');
      expect(model.cnlContent).toBe('');
      expect(model.jsonContent).toEqual({});
      expect(model.dataModelContent).toEqual({});
    });

    test('should initialize with no validation errors', () => {
      expect(model.validationErrors).toEqual([]);
    });
  });

  describe('loadComponent()', () => {
    test('should load component from store', async () => {
      const created = await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'Test :: s => div { "Hello" }',
        cnl: 'Test with s shows div with "Hello"',
        json: { type: 'div', children: ['Hello'] },
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      expect(model.currentComponent).toEqual(created);
    });

    test('should populate content from loaded component', async () => {
      const created = await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'Test :: s => div { "Hello" }',
        cnl: 'Test with s shows div with "Hello"',
        json: { type: 'div', children: ['Hello'] },
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      expect(model.dslContent).toBe('Test :: s => div { "Hello" }');
      expect(model.cnlContent).toBe('Test with s shows div with "Hello"');
      expect(model.jsonContent).toEqual({ type: 'div', children: ['Hello'] });
      expect(model.dataModelContent).toEqual({ entityName: 's', schema: {}, sampleData: {} });
    });

    test('should reset dirty flag after loading', async () => {
      const created = await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'Test :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      model.isDirty = true;
      await model.loadComponent(created.id);

      expect(model.isDirty).toBe(false);
    });

    test('should throw error if component not found', async () => {
      await expect(model.loadComponent('nonexistent'))
        .rejects.toThrow('Component not found');
    });
  });

  describe('saveComponent()', () => {
    test('should create new component when no current component', async () => {
      model.dslContent = 'New :: s => div';
      model.cnlContent = 'New with s shows div';
      model.jsonContent = { type: 'div' };
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };

      const saved = await model.saveComponent();

      expect(saved.id).toBeDefined();
      expect(saved.dsl).toBe('New :: s => div');
      expect(model.currentComponent).toEqual(saved);
    });

    test('should update existing component when current component exists', async () => {
      const created = await componentStore.createComponent({
        name: 'Original',
        dsl: 'Original :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);
      model.dslContent = 'Updated :: s => span';
      model.isDirty = true;

      const saved = await model.saveComponent();

      expect(saved.id).toBe(created.id);
      expect(saved.dsl).toBe('Updated :: s => span');
      expect(saved.version).toBe(2);
    });

    test('should reset dirty flag after saving', async () => {
      model.dslContent = 'New :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      model.isDirty = true;

      await model.saveComponent();

      expect(model.isDirty).toBe(false);
    });

    test('should validate before saving', async () => {
      // Invalid: missing entityName in dataModel
      model.dslContent = 'Test :: s => div';
      model.dataModelContent = { schema: {}, sampleData: {} };

      await expect(model.saveComponent())
        .rejects.toThrow(/Validation failed/);
    });

    test('should update modified timestamp on save', async () => {
      model.dslContent = 'New :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };

      const saved = await model.saveComponent();

      expect(saved.modified).toBeDefined();
      expect(new Date(saved.modified)).not.toBe('Invalid Date');
    });
  });

  describe('deleteComponent()', () => {
    test('should delete current component from store', async () => {
      const created = await componentStore.createComponent({
        name: 'DeleteMe',
        dsl: 'Delete :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);
      const result = await model.deleteComponent();

      expect(result).toBe(true);
      await expect(componentStore.getComponent(created.id))
        .resolves.toBeNull();
    });

    test('should return false when no current component', async () => {
      const result = await model.deleteComponent();
      expect(result).toBe(false);
    });

    test('should clear current component after deletion', async () => {
      const created = await componentStore.createComponent({
        name: 'DeleteMe',
        dsl: 'Delete :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);
      await model.deleteComponent();

      expect(model.currentComponent).toBeNull();
    });
  });

  describe('Dirty State Tracking', () => {
    test('should mark as dirty when content changes', () => {
      model.dslContent = 'Changed :: s => div';
      model.markDirty();

      expect(model.isDirty).toBe(true);
    });

    test('should not be dirty after load', async () => {
      const created = await componentStore.createComponent({
        name: 'Test',
        dsl: 'Test :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      expect(model.isDirty).toBe(false);
    });

    test('should not be dirty after save', async () => {
      model.dslContent = 'New :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      model.isDirty = true;

      await model.saveComponent();

      expect(model.isDirty).toBe(false);
    });
  });

  describe('Format Conversion', () => {
    test('convertDSLtoCNL() should convert DSL to CNL format', () => {
      model.dslContent = 'Test :: state => div { "Hello" }';
      model.convertDSLtoCNL();

      expect(model.cnlContent).toBeDefined();
      expect(model.cnlContent.length).toBeGreaterThan(0);
    });

    test('convertCNLtoDSL() should convert CNL to DSL format', () => {
      model.cnlContent = 'Test with state shows div with "Hello"';
      model.convertCNLtoDSL();

      expect(model.dslContent).toBeDefined();
      expect(model.dslContent.length).toBeGreaterThan(0);
    });

    test('convertToJSON() should parse DSL to JSON', () => {
      model.dslContent = 'Test :: state => div { "Hello" }';
      model.convertToJSON();

      expect(model.jsonContent).toBeDefined();
      expect(typeof model.jsonContent).toBe('object');
    });

    test('conversions should mark model as dirty', () => {
      model.isDirty = false;
      model.dslContent = 'Test :: s => div';
      model.convertDSLtoCNL();

      expect(model.isDirty).toBe(true);
    });
  });

  describe('Validation', () => {
    test('validate() should return true for valid component', () => {
      model.dslContent = 'Valid :: state => div { "Test" }';
      model.dataModelContent = { entityName: 'state', schema: {}, sampleData: {} };

      const result = model.validate();

      expect(result).toBe(true);
      expect(model.validationErrors).toEqual([]);
    });

    test('validate() should return false for invalid DSL syntax', () => {
      model.dslContent = 'Invalid syntax here';
      model.dataModelContent = { entityName: 'state', schema: {}, sampleData: {} };

      const result = model.validate();

      expect(result).toBe(false);
      expect(model.validationErrors.length).toBeGreaterThan(0);
      expect(model.validationErrors[0]).toMatch(/DSL/);
    });

    test('validate() should return false for missing entityName', () => {
      model.dslContent = 'Test :: s => div';
      model.dataModelContent = { schema: {}, sampleData: {} };

      const result = model.validate();

      expect(result).toBe(false);
      expect(model.validationErrors.length).toBeGreaterThan(0);
      expect(model.validationErrors.some(e => e.includes('Entity name'))).toBe(true);
    });

    test('validate() should clear previous validation errors', () => {
      model.dslContent = 'Invalid';
      model.dataModelContent = {};
      model.validate();

      const firstErrorCount = model.validationErrors.length;

      model.dslContent = 'Valid :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      model.validate();

      expect(model.validationErrors.length).toBeLessThan(firstErrorCount);
    });
  });

  describe('Active Format', () => {
    test('should track active editing format', () => {
      model.setActiveFormat('cnl');
      expect(model.activeFormat).toBe('cnl');

      model.setActiveFormat('json');
      expect(model.activeFormat).toBe('json');

      model.setActiveFormat('dataModel');
      expect(model.activeFormat).toBe('dataModel');
    });

    test('should default to DSL format', () => {
      expect(model.activeFormat).toBe('dsl');
    });
  });

  describe('runTests()', () => {
    test('should execute component tests with test data', async () => {
      const created = await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'Test :: state => div { state.message }',
        dataModel: {
          entityName: 'state',
          schema: {
            properties: {
              message: { type: 'string' }
            }
          },
          sampleData: { message: 'Hello' }
        }
      });

      await model.loadComponent(created.id);

      const results = await model.runTests();

      expect(results).toBeDefined();
      expect(results.total).toBeDefined();
      expect(results.passed).toBeDefined();
      expect(results.failed).toBeDefined();
      expect(results.tests).toBeDefined();
    });

    test('should return test results with pass/fail status', async () => {
      model.dslContent = 'Test :: state => div';
      model.dataModelContent = { entityName: 'state', schema: {}, sampleData: {} };

      const results = await model.runTests();

      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('tests');
    });
  });
});
