/**
 * ComponentLibraryHandle Tests - Phase 1.5
 *
 * Tests for ComponentLibraryHandle class implementation
 */

import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { SimpleObjectDataSource } from '@legion/handle';

describe('ComponentLibraryHandle', () => {
  let dataSource;
  let testComponents;

  beforeEach(() => {
    // Create test component data
    testComponents = [
      {
        id: 'comp_1',
        name: 'UserProfile',
        description: 'User profile component',
        dsl: 'UserProfile :: user => div.profile { user.name }',
        dataModel: { entityName: 'user', schema: {}, sampleData: {} },
        author: 'alice',
        tags: ['user', 'profile'],
        category: 'user-interface',
        created: '2025-10-01T12:00:00Z',
        modified: '2025-10-01T12:00:00Z',
        version: 1
      },
      {
        id: 'comp_2',
        name: 'LoginForm',
        description: 'Login form component',
        dsl: 'LoginForm :: form => div.login-form [...]',
        dataModel: { entityName: 'form', schema: {}, sampleData: {} },
        author: 'bob',
        tags: ['form', 'auth'],
        category: 'forms',
        created: '2025-10-02T12:00:00Z',
        modified: '2025-10-02T12:00:00Z',
        version: 1
      },
      {
        id: 'comp_3',
        name: 'DataGrid',
        description: 'Data grid component',
        dsl: 'DataGrid :: data => div.grid [...]',
        dataModel: { entityName: 'data', schema: {}, sampleData: {} },
        author: 'alice',
        tags: ['grid', 'data'],
        category: 'data-display',
        created: '2025-10-03T12:00:00Z',
        modified: '2025-10-03T12:00:00Z',
        version: 1
      }
    ];

    dataSource = new SimpleObjectDataSource([...testComponents]);
  });

  describe('Constructor', () => {
    test('should create ComponentLibraryHandle with dataSource', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      expect(handle).toBeInstanceOf(ComponentLibraryHandle);
      expect(handle.dataSource).toBe(dataSource);
    });

    test('should throw error if dataSource is missing', () => {
      expect(() => new ComponentLibraryHandle(null)).toThrow();
    });
  });

  describe('Query Methods', () => {
    test('all() should return all components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.all();

      expect(Array.isArray(components)).toBe(true);
      expect(components.length).toBe(3);
    });

    test('byTag() should return components with specified tag', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.byTag('user');

      expect(components.length).toBe(1);
      expect(components[0].name).toBe('UserProfile');
    });

    test('byTag() should return empty array if no matches', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.byTag('nonexistent');

      expect(components).toEqual([]);
    });

    test('byAuthor() should return components by author', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.byAuthor('alice');

      expect(components.length).toBe(2);
      expect(components.map(c => c.name)).toContain('UserProfile');
      expect(components.map(c => c.name)).toContain('DataGrid');
    });

    test('byCategory() should return components in category', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.byCategory('forms');

      expect(components.length).toBe(1);
      expect(components[0].name).toBe('LoginForm');
    });

    test('recent() should return most recent components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.recent(2);

      expect(components.length).toBe(2);
      expect(components[0].name).toBe('DataGrid'); // Most recent
      expect(components[1].name).toBe('LoginForm');
    });

    test('recent() should return all if limit exceeds total', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.recent(10);

      expect(components.length).toBe(3);
    });

    test('filter() should accept predicate function for client-side filtering', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.filter(c => c.version === 1 && c.author === 'alice');

      expect(components.length).toBe(2);
      expect(components.map(c => c.name)).toContain('UserProfile');
      expect(components.map(c => c.name)).toContain('DataGrid');
    });

    test('filter() should support complex predicates', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.filter(c =>
        c.tags.includes('form') || c.tags.includes('grid')
      );

      expect(components.length).toBe(2);
    });
  });

  describe('CRUD Operations', () => {
    test('get() should return ComponentHandle for specific id', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const componentHandle = handle.get('comp_1');

      expect(componentHandle).toBeDefined();
      expect(componentHandle.componentId).toBe('comp_1');
      expect(componentHandle.value().name).toBe('UserProfile');
    });

    test('get() should return handle even if component not found', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const componentHandle = handle.get('nonexistent');

      expect(componentHandle).toBeDefined();
      expect(componentHandle.componentId).toBe('nonexistent');
      expect(componentHandle.value()).toBeNull();
    });

    test('create() should add new component to library', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const newComponent = {
        name: 'NewComponent',
        dsl: 'NewComponent :: state => div.new',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} },
        author: 'charlie',
        tags: ['new']
      };

      const created = handle.create(newComponent);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe('NewComponent');
      expect(created.created).toBeDefined();
      expect(created.modified).toBeDefined();
      expect(created.version).toBe(1);

      // Verify it was added to dataSource
      const allComponents = handle.all();
      expect(allComponents.length).toBe(4);
    });

    test('update() should modify existing component', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const updated = handle.update('comp_1', {
        description: 'Updated description'
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe(2); // Version incremented
      expect(updated.modified).not.toBe(testComponents[0].modified);
    });

    test('update() should throw error for non-existent component', () => {
      const handle = new ComponentLibraryHandle(dataSource);

      expect(() => handle.update('nonexistent', { name: 'New' }))
        .toThrow('Component not found');
    });

    test('delete() should remove component from library', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const result = handle.delete('comp_1');

      expect(result).toBe(true);

      const allComponents = handle.all();
      expect(allComponents.length).toBe(2);
      expect(allComponents.find(c => c.id === 'comp_1')).toBeUndefined();
    });

    test('delete() should return false for non-existent component', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const result = handle.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    test('import() should add multiple components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const newComponents = [
        {
          name: 'Component1',
          dsl: 'Comp1 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Component2',
          dsl: 'Comp2 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        }
      ];

      const imported = handle.import(newComponents);

      expect(imported.length).toBe(2);
      expect(imported[0].id).toBeDefined();
      expect(imported[1].id).toBeDefined();

      const allComponents = handle.all();
      expect(allComponents.length).toBe(5); // 3 + 2
    });

    test('export() should return specified components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const exported = handle.export(['comp_1', 'comp_2']);

      expect(exported.length).toBe(2);
      expect(exported.map(c => c.id)).toContain('comp_1');
      expect(exported.map(c => c.id)).toContain('comp_2');
    });

    test('export() should skip non-existent components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const exported = handle.export(['comp_1', 'nonexistent', 'comp_2']);

      expect(exported.length).toBe(2);
      expect(exported.map(c => c.id)).toContain('comp_1');
      expect(exported.map(c => c.id)).toContain('comp_2');
    });

    test('export() should return all components if no ids specified', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const exported = handle.export();

      expect(exported.length).toBe(3);
    });
  });

  describe('Handle Methods', () => {
    test('value() should return all components', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const components = handle.value();

      expect(Array.isArray(components)).toBe(true);
      expect(components.length).toBe(3);
    });

    test('query() should execute queries through dataSource', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      const results = handle.query({ author: 'alice' });

      expect(results.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when accessing destroyed handle', () => {
      const handle = new ComponentLibraryHandle(dataSource);
      handle.destroy();

      expect(() => handle.all()).toThrow();
    });
  });
});
