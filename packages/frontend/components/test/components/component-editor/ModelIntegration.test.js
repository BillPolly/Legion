/**
 * Model Integration Tests - Phase 3.5
 *
 * End-to-end tests for ComponentEditorModel with full backend stack
 * Tests complete editing workflows using real components (NO MOCKS)
 */

import { ComponentEditorModel } from '../../../src/components/component-editor/src/model/ComponentEditorModel.js';
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

describe('Model Integration Tests - Phase 3.5', () => {
  let database;
  let actor;
  let dataSource;
  let handle;
  let model;

  beforeEach(() => {
    // Create full stack - NO MOCKS
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    handle = new ComponentLibraryHandle(dataSource);
    model = new ComponentEditorModel({ componentStore: handle });
  });

  afterEach(() => {
    database.clear();
  });

  describe('Loading Component into Model', () => {
    test('should load component from backend into model', async () => {
      // Create component via Handle (persists to database)
      const created = await handle.createComponent({
        name: 'LoadTest',
        dsl: 'LoadTest :: state => div { "Hello" }',
        cnl: 'LoadTest with state shows div with "Hello"',
        json: { type: 'div', children: ['Hello'] },
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      });

      // Load into Model
      await model.loadComponent(created.id);

      // Verify Model populated from backend
      expect(model.currentComponent.id).toBe(created.id);
      expect(model.dslContent).toBe('LoadTest :: state => div { "Hello" }');
      expect(model.cnlContent).toBe('LoadTest with state shows div with "Hello"');
      expect(model.jsonContent).toEqual({ type: 'div', children: ['Hello'] });
      expect(model.dataModelContent.entityName).toBe('state');
    });

    test('should load component and reset dirty state', async () => {
      const created = await handle.createComponent({
        name: 'DirtyTest',
        dsl: 'DirtyTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      model.isDirty = true;
      await model.loadComponent(created.id);

      expect(model.isDirty).toBe(false);
    });

    test('should throw error if component not in backend', async () => {
      await expect(model.loadComponent('nonexistent'))
        .rejects.toThrow('Component not found');
    });
  });

  describe('Editing and Saving Component', () => {
    test('should edit loaded component and save changes to backend', async () => {
      // Create initial component
      const created = await handle.createComponent({
        name: 'EditTest',
        dsl: 'Original :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      // Load into Model
      await model.loadComponent(created.id);

      // Edit content
      model.dslContent = 'Updated :: state => span';
      model.markDirty();

      expect(model.isDirty).toBe(true);

      // Save via Model
      const saved = await model.saveComponent();

      // Verify changes persisted to backend
      expect(saved.dsl).toBe('Updated :: state => span');
      expect(saved.version).toBe(2);
      expect(model.isDirty).toBe(false);

      // Verify database has updated version
      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.dsl).toBe('Updated :: state => span');
      expect(fromDb.version).toBe(2);
    });

    test('should create new component when no current component', async () => {
      // Set content without loading
      model.dslContent = 'NewComponent :: state => div { "New" }';
      model.cnlContent = 'NewComponent with state shows div with "New"';
      model.dataModelContent = {
        entityName: 'state',
        schema: {},
        sampleData: {}
      };

      // Save via Model
      const saved = await model.saveComponent();

      // Verify created in backend
      expect(saved.id).toBeDefined();
      expect(saved.version).toBe(1);

      // Verify in database
      const fromDb = await database.findOne('components', { id: saved.id });
      expect(fromDb).toBeDefined();
      expect(fromDb.dsl).toBe('NewComponent :: state => div { "New" }');
    });

    test('should update model state after save', async () => {
      model.dslContent = 'Test :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      model.isDirty = true;

      const saved = await model.saveComponent();

      expect(model.currentComponent).toEqual(saved);
      expect(model.isDirty).toBe(false);
    });
  });

  describe('Format Conversion Workflow', () => {
    test('should convert DSL to CNL and persist changes', async () => {
      // Create component with DSL
      const created = await handle.createComponent({
        name: 'ConvertTest',
        dsl: 'ConvertTest :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      // Convert DSL to CNL
      model.convertDSLtoCNL();

      expect(model.cnlContent).toBeDefined();
      expect(model.cnlContent.length).toBeGreaterThan(0);
      expect(model.isDirty).toBe(true);

      // Save converted content
      const saved = await model.saveComponent();

      // Verify conversion persisted
      expect(saved.cnl).toBe(model.cnlContent);

      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.cnl).toBe(model.cnlContent);
    });

    test('should convert CNL to DSL and persist changes', async () => {
      const created = await handle.createComponent({
        name: 'CNLTest',
        cnl: 'CNLTest with state shows span',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      // Convert CNL to DSL
      model.convertCNLtoDSL();

      expect(model.dslContent).toBeDefined();
      expect(model.dslContent.length).toBeGreaterThan(0);
      expect(model.isDirty).toBe(true);

      // Save converted content
      const saved = await model.saveComponent();

      // Verify conversion persisted
      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.dsl).toBe(model.dslContent);
    });

    test('should convert DSL to JSON format', async () => {
      const created = await handle.createComponent({
        name: 'JSONTest',
        dsl: 'JSONTest :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      await model.loadComponent(created.id);

      // Convert to JSON
      model.convertToJSON();

      expect(model.jsonContent).toBeDefined();
      expect(typeof model.jsonContent).toBe('object');
      expect(model.isDirty).toBe(true);

      // Save JSON representation
      const saved = await model.saveComponent();

      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.json).toEqual(model.jsonContent);
    });
  });

  describe('Validation Workflow with Errors', () => {
    test('should prevent saving invalid component', async () => {
      // Set invalid content (missing entityName)
      model.dslContent = 'Invalid :: state => div';
      model.dataModelContent = { schema: {}, sampleData: {} };

      // Attempt to save
      await expect(model.saveComponent())
        .rejects.toThrow(/Validation failed/);

      // Verify nothing saved to database
      const all = await database.find('components', {});
      expect(all.length).toBe(0);
    });

    test('should collect validation errors', async () => {
      model.dslContent = 'Invalid';  // Bad DSL syntax
      model.dataModelContent = {};     // Missing entityName

      const isValid = model.validate();

      expect(isValid).toBe(false);
      expect(model.validationErrors.length).toBeGreaterThan(0);
      expect(model.validationErrors.some(e => e.includes('DSL'))).toBe(true);
      expect(model.validationErrors.some(e => e.includes('Entity name'))).toBe(true);
    });

    test('should allow saving after fixing validation errors', async () => {
      // Start with invalid content
      model.dslContent = 'Invalid';
      model.dataModelContent = {};

      let isValid = model.validate();
      expect(isValid).toBe(false);

      // Fix errors
      model.dslContent = 'Valid :: state => div';
      model.dataModelContent = { entityName: 'state', schema: {}, sampleData: {} };

      isValid = model.validate();
      expect(isValid).toBe(true);

      // Should save successfully
      const saved = await model.saveComponent();
      expect(saved.id).toBeDefined();
    });
  });

  describe('Complete Editing Session', () => {
    test('should handle full editing workflow: create → edit → convert → validate → save', async () => {
      // 1. Create new component
      model.dslContent = 'MyComponent :: state => div { state.message }';
      model.dataModelContent = {
        entityName: 'state',
        schema: {
          properties: {
            message: { type: 'string' }
          }
        },
        sampleData: { message: 'Hello World' }
      };

      const created = await model.saveComponent();
      expect(created.id).toBeDefined();
      expect(model.isDirty).toBe(false);

      // 2. Load for editing
      await model.loadComponent(created.id);
      expect(model.currentComponent.id).toBe(created.id);

      // 3. Edit content
      model.dslContent = 'MyComponent :: state => span { state.message }';
      model.markDirty();
      expect(model.isDirty).toBe(true);

      // 4. Convert DSL to CNL
      model.convertDSLtoCNL();
      expect(model.cnlContent).toBeDefined();

      // 5. Validate
      const isValid = model.validate();
      expect(isValid).toBe(true);

      // 6. Save changes
      const updated = await model.saveComponent();
      expect(updated.version).toBe(2);
      expect(updated.dsl).toBe('MyComponent :: state => span { state.message }');
      expect(model.isDirty).toBe(false);

      // 7. Verify persistence
      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb.dsl).toBe('MyComponent :: state => span { state.message }');
      expect(fromDb.version).toBe(2);
    });

    test('should handle workflow: load → edit → delete', async () => {
      // Create component
      const created = await handle.createComponent({
        name: 'DeleteMe',
        dsl: 'DeleteMe :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      });

      // Load into Model
      await model.loadComponent(created.id);
      expect(model.currentComponent).toBeDefined();

      // Delete via Model
      const result = await model.deleteComponent();
      expect(result).toBe(true);

      // Verify Model cleared
      expect(model.currentComponent).toBeNull();
      expect(model.isDirty).toBe(false);

      // Verify deleted from database
      const fromDb = await database.findOne('components', { id: created.id });
      expect(fromDb).toBeNull();
    });

    test('should handle multiple components in same session', async () => {
      // Create first component
      model.dslContent = 'Component1 :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      const comp1 = await model.saveComponent();

      // Clear current component to create new one
      model.currentComponent = null;

      // Create second component
      model.dslContent = 'Component2 :: s => span';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };
      const comp2 = await model.saveComponent();

      // Load and edit first component
      await model.loadComponent(comp1.id);
      model.dslContent = 'Component1Updated :: s => p';
      await model.saveComponent();

      // Load and edit second component
      await model.loadComponent(comp2.id);
      model.dslContent = 'Component2Updated :: s => strong';
      await model.saveComponent();

      // Verify both components in database
      const all = await database.find('components', {});
      expect(all.length).toBe(2);

      const db1 = await database.findOne('components', { id: comp1.id });
      expect(db1.dsl).toBe('Component1Updated :: s => p');

      const db2 = await database.findOne('components', { id: comp2.id });
      expect(db2.dsl).toBe('Component2Updated :: s => strong');
    });
  });

  describe('Error Recovery', () => {
    test('should recover from save failure', async () => {
      // Set invalid content
      model.dslContent = 'Invalid';
      model.dataModelContent = {};
      model.markDirty();

      // Attempt save (should fail validation)
      await expect(model.saveComponent())
        .rejects.toThrow(/Validation failed/);

      // Model should still be dirty
      expect(model.isDirty).toBe(true);

      // Fix and save
      model.dslContent = 'Fixed :: s => div';
      model.dataModelContent = { entityName: 's', schema: {}, sampleData: {} };

      const saved = await model.saveComponent();
      expect(saved.id).toBeDefined();
      expect(model.isDirty).toBe(false);
    });

    test('should handle load failure gracefully', async () => {
      await expect(model.loadComponent('nonexistent'))
        .rejects.toThrow('Component not found');

      // Model should remain in clean state
      expect(model.currentComponent).toBeNull();
      expect(model.dslContent).toBe('');
    });
  });
});
