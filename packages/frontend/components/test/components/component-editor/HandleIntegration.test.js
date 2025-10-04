/**
 * Handle Integration Tests - Phase 1.6
 *
 * Integration tests for Handle classes working together
 * NO MOCKS - Uses real Handle instances, real DataSource
 */

import { ComponentHandle } from '../../../src/components/component-editor/src/handles/ComponentHandle.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { SimpleObjectDataSource } from '@legion/handle';

describe('Handle Integration Tests', () => {
  let dataSource;
  let library;

  beforeEach(() => {
    // Create real data source with no mocks
    dataSource = new SimpleObjectDataSource([]);
    library = new ComponentLibraryHandle(dataSource);
  });

  afterEach(() => {
    library.destroy();
  });

  describe('Creating ComponentHandle from data', () => {
    test('should create ComponentHandle from library and access data', () => {
      // Create component in library
      const created = library.create({
        name: 'TestComponent',
        description: 'A test component',
        dsl: 'TestComponent :: state => div.test { state.value }',
        cnl: 'Define TestComponent with state: A div showing state value',
        json: {
          name: 'TestComponent',
          entity: 'state',
          structure: {},
          bindings: []
        },
        dataModel: {
          entityName: 'state',
          schema: {
            value: { type: 'string', description: 'Test value' }
          },
          sampleData: {
            value: 'Hello'
          }
        },
        author: 'human',
        tags: ['test']
      });

      // Get handle for component
      const handle = library.get(created.id);

      // Verify data access
      const data = handle.value();
      expect(data).toBeDefined();
      expect(data.name).toBe('TestComponent');
      expect(data.description).toBe('A test component');
      expect(data.author).toBe('human');

      // Cleanup
      handle.destroy();
    });

    test('should create multiple components and retrieve them via library', () => {
      // Create multiple components
      const comp1 = library.create({
        name: 'Component1',
        dsl: 'Comp1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        tags: ['test1']
      });

      const comp2 = library.create({
        name: 'Component2',
        dsl: 'Comp2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        tags: ['test2']
      });

      // Verify library contains both
      const all = library.all();
      expect(all.length).toBe(2);
      expect(all.map(c => c.name)).toContain('Component1');
      expect(all.map(c => c.name)).toContain('Component2');

      // Get individual handles
      const handle1 = library.get(comp1.id);
      const handle2 = library.get(comp2.id);

      expect(handle1.value().name).toBe('Component1');
      expect(handle2.value().name).toBe('Component2');

      // Cleanup
      handle1.destroy();
      handle2.destroy();
    });
  });

  describe('ComponentHandle conversion workflow (DSL→CNL→JSON)', () => {
    test('should convert between all three formats', () => {
      // Create component with all formats
      const created = library.create({
        name: 'ConversionTest',
        dsl: 'ConversionTest :: data => div.container { data.text }',
        cnl: 'Define ConversionTest with data: A container div showing data text',
        json: {
          name: 'ConversionTest',
          entity: 'data',
          structure: { type: 'div', class: 'container' },
          bindings: [{ field: 'text' }]
        },
        dataModel: { entityName: 'data', schema: {}, sampleData: {} }
      });

      const handle = library.get(created.id);

      // Test DSL conversion
      const dsl = handle.toDSL();
      expect(dsl).toBe('ConversionTest :: data => div.container { data.text }');

      // Test CNL conversion
      const cnl = handle.toCNL();
      expect(cnl).toBe('Define ConversionTest with data: A container div showing data text');

      // Test JSON conversion
      const json = handle.toJSON();
      expect(json).toEqual({
        name: 'ConversionTest',
        entity: 'data',
        structure: { type: 'div', class: 'container' },
        bindings: [{ field: 'text' }]
      });

      handle.destroy();
    });

    test('should handle conversion when formats are missing', () => {
      const created = library.create({
        name: 'MinimalComponent',
        dsl: 'Minimal :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const handle = library.get(created.id);

      expect(handle.toDSL()).toBe('Minimal :: s => div');
      expect(handle.toCNL()).toBeUndefined();
      expect(handle.toJSON()).toBeUndefined();

      handle.destroy();
    });
  });

  describe('ComponentHandle validation workflow', () => {
    test('should validate valid component', () => {
      const created = library.create({
        name: 'ValidComponent',
        dsl: 'Valid :: state => div',
        dataModel: {
          entityName: 'state',
          schema: {
            value: { type: 'string' }
          },
          sampleData: {
            value: 'test'
          }
        }
      });

      const handle = library.get(created.id);
      const validation = handle.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);

      handle.destroy();
    });

    test('should detect validation errors in component', () => {
      const created = library.create({
        name: 123, // Invalid: should be string
        dsl: 'Invalid :: state => div',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      });

      const handle = library.get(created.id);
      const validation = handle.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('name must be a string');

      handle.destroy();
    });

    test('should validate data model structure', () => {
      const created = library.create({
        name: 'DataModelTest',
        dsl: 'Test :: state => div',
        dataModel: {
          entityName: 'state',
          schema: {
            age: { type: 'number' }
          },
          sampleData: {
            age: 25
          }
        }
      });

      const handle = library.get(created.id);
      const dataModelHandle = handle.dataModel();

      // Validate sample data
      const validData = dataModelHandle.validateData({ age: 30 });
      expect(validData.isValid).toBe(true);

      const invalidData = dataModelHandle.validateData({ age: 'not a number' });
      expect(invalidData.isValid).toBe(false);
      expect(invalidData.errors).toContain('Field "age" must be a number');

      handle.destroy();
    });
  });

  describe('ComponentLibraryHandle managing multiple components', () => {
    test('should manage complete CRUD workflow', () => {
      // CREATE
      const created = library.create({
        name: 'CRUDTest',
        dsl: 'CRUD :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} },
        author: 'alice',
        tags: ['crud', 'test']
      });

      expect(created.id).toBeDefined();
      expect(created.version).toBe(1);

      // READ
      const handle = library.get(created.id);
      const data = handle.value();
      expect(data.name).toBe('CRUDTest');

      // UPDATE
      const updated = library.update(created.id, {
        description: 'Updated description'
      });
      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe(2);

      // Verify update via handle
      const updatedData = handle.value();
      expect(updatedData.description).toBe('Updated description');

      // DELETE
      const deleted = library.delete(created.id);
      expect(deleted).toBe(true);

      // Verify deletion
      const afterDelete = handle.value();
      expect(afterDelete).toBeNull();

      handle.destroy();
    });

    test('should query components by various criteria', () => {
      // Create test components
      library.create({
        name: 'ProfileCard',
        dsl: 'Profile :: user => div',
        dataModel: { entityName: 'user', schema: {}, sampleData: {} },
        author: 'alice',
        tags: ['user', 'profile'],
        category: 'user-interface'
      });

      library.create({
        name: 'LoginForm',
        dsl: 'Login :: form => div',
        dataModel: { entityName: 'form', schema: {}, sampleData: {} },
        author: 'bob',
        tags: ['auth', 'form'],
        category: 'forms'
      });

      library.create({
        name: 'DataTable',
        dsl: 'Table :: data => div',
        dataModel: { entityName: 'data', schema: {}, sampleData: {} },
        author: 'alice',
        tags: ['data', 'table'],
        category: 'data-display'
      });

      // Query by tag
      const userComponents = library.byTag('user');
      expect(userComponents.length).toBe(1);
      expect(userComponents[0].name).toBe('ProfileCard');

      // Query by author
      const aliceComponents = library.byAuthor('alice');
      expect(aliceComponents.length).toBe(2);
      expect(aliceComponents.map(c => c.name)).toContain('ProfileCard');
      expect(aliceComponents.map(c => c.name)).toContain('DataTable');

      // Query by category
      const formComponents = library.byCategory('forms');
      expect(formComponents.length).toBe(1);
      expect(formComponents[0].name).toBe('LoginForm');

      // Recent components
      const recent = library.recent(2);
      expect(recent.length).toBe(2);

      // Filter with predicate
      const filtered = library.filter(c =>
        c.author === 'alice' && c.tags.includes('user')
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('ProfileCard');
    });

    test('should support batch import/export operations', () => {
      // Import multiple components
      const toImport = [
        {
          name: 'Import1',
          dsl: 'I1 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import2',
          dsl: 'I2 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import3',
          dsl: 'I3 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        }
      ];

      const imported = library.import(toImport);
      expect(imported.length).toBe(3);
      expect(imported.every(c => c.id && c.version === 1)).toBe(true);

      // Export specific components
      const ids = [imported[0].id, imported[2].id];
      const exported = library.export(ids);
      expect(exported.length).toBe(2);
      expect(exported.map(c => c.name)).toContain('Import1');
      expect(exported.map(c => c.name)).toContain('Import3');

      // Export all
      const allExported = library.export();
      expect(allExported.length).toBe(3);
    });

    test('should maintain data model handles across operations', () => {
      const created = library.create({
        name: 'DataModelComponent',
        dsl: 'DMC :: user => div',
        dataModel: {
          entityName: 'user',
          schema: {
            name: { type: 'string', description: 'Name' },
            age: { type: 'number', description: 'Age' }
          },
          sampleData: {
            name: 'John',
            age: 30
          }
        }
      });

      const handle = library.get(created.id);
      const dataModel = handle.dataModel();

      // Verify initial state
      expect(dataModel.entityName).toBe('user');
      expect(dataModel.schema.name.type).toBe('string');
      expect(dataModel.sampleData.name).toBe('John');

      // Modify data model
      dataModel.addField('email', 'string', 'Email');
      dataModel.updateSampleData({ email: 'john@example.com' });

      // Verify changes
      expect(dataModel.schema.email).toBeDefined();
      expect(dataModel.sampleData.email).toBe('john@example.com');

      // Validate with new schema
      const validation = dataModel.validateData({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com'
      });
      expect(validation.isValid).toBe(true);

      handle.destroy();
    });
  });

  describe('Complete workflow integration', () => {
    test('should support complete component lifecycle', () => {
      // 1. Create component in library
      const created = library.create({
        name: 'LifecycleComponent',
        description: 'Testing complete lifecycle',
        dsl: 'LC :: state => div.container { state.text }',
        cnl: 'Define LC with state: A container showing text',
        json: { name: 'LC', entity: 'state', structure: {}, bindings: [] },
        dataModel: {
          entityName: 'state',
          schema: {
            text: { type: 'string', description: 'Display text' }
          },
          sampleData: {
            text: 'Hello World'
          }
        },
        author: 'human',
        tags: ['lifecycle', 'test'],
        category: 'testing'
      });

      expect(created.version).toBe(1);

      // 2. Get handle and verify data
      const handle = library.get(created.id);
      expect(handle.value().name).toBe('LifecycleComponent');

      // 3. Validate component
      const validation = handle.validate();
      expect(validation.isValid).toBe(true);

      // 4. Test conversions
      expect(handle.toDSL()).toContain('LC :: state => div.container');
      expect(handle.toCNL()).toContain('Define LC with state');
      expect(handle.toJSON().name).toBe('LC');

      // 5. Access and modify data model
      const dataModel = handle.dataModel();
      dataModel.addField('count', 'number', 'Counter');
      dataModel.updateSampleData({ count: 0 });

      expect(dataModel.schema.count).toBeDefined();
      expect(dataModel.sampleData.count).toBe(0);

      // 6. Update component
      const updated = library.update(created.id, {
        description: 'Updated lifecycle component'
      });
      expect(updated.version).toBe(2);
      expect(updated.description).toBe('Updated lifecycle component');

      // 7. Query component via library
      const byTag = library.byTag('lifecycle');
      expect(byTag.length).toBe(1);
      expect(byTag[0].id).toBe(created.id);

      // 8. Export component
      const exported = library.export([created.id]);
      expect(exported.length).toBe(1);
      expect(exported[0].name).toBe('LifecycleComponent');

      // 9. Delete component
      const deleted = library.delete(created.id);
      expect(deleted).toBe(true);

      // 10. Verify deletion
      expect(handle.value()).toBeNull();
      expect(library.all().length).toBe(0);

      handle.destroy();
    });
  });
});
