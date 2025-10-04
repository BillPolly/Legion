/**
 * ComponentHandle Tests - Phase 1.3
 *
 * Tests for ComponentHandle class implementation
 */

import { ComponentHandle } from '../../../src/components/component-editor/src/handles/ComponentHandle.js';
import { SimpleObjectDataSource } from '@legion/handle';

describe('ComponentHandle', () => {
  let dataSource;
  let componentData;

  beforeEach(() => {
    // Create test component data
    componentData = {
      id: 'comp_123',
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
      tags: ['test'],
      created: '2025-10-04T12:00:00Z',
      modified: '2025-10-04T12:00:00Z',
      version: 1
    };

    // Create data source with component data (SimpleObjectDataSource expects array)
    dataSource = new SimpleObjectDataSource([componentData]);
  });

  describe('Constructor', () => {
    test('should create ComponentHandle with dataSource and componentId', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      expect(handle).toBeInstanceOf(ComponentHandle);
      expect(handle.componentId).toBe('comp_123');
      expect(handle.dataSource).toBe(dataSource);
    });

    test('should throw error if dataSource is missing', () => {
      expect(() => new ComponentHandle(null, 'comp_123')).toThrow();
    });
  });

  describe('value() method', () => {
    test('should return component data for specified componentId', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const value = handle.value();
      expect(value).toEqual(componentData);
    });

    test('should return null for non-existent componentId', () => {
      const handle = new ComponentHandle(dataSource, 'non_existent');
      const value = handle.value();
      expect(value).toBeNull();
    });
  });

  describe('Conversion methods', () => {
    test('toDSL() should return DSL string', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const dsl = handle.toDSL();
      expect(dsl).toBe('TestComponent :: state => div.test { state.value }');
    });

    test('toCNL() should return CNL string', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const cnl = handle.toCNL();
      expect(cnl).toBe('Define TestComponent with state: A div showing state value');
    });

    test('toJSON() should return JSON object', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const json = handle.toJSON();
      expect(json).toEqual({
        name: 'TestComponent',
        entity: 'state',
        structure: {},
        bindings: []
      });
    });
  });

  describe('validate() method', () => {
    test('should validate correct component data', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const result = handle.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should detect validation errors in component data', () => {
      // Create invalid component data
      const invalidData = {
        id: 'invalid_comp',
        name: 123, // Invalid: should be string
        dsl: 'Invalid :: test',
        dataModel: {
          entityName: 'test',
          schema: {},
          sampleData: {}
        }
      };

      const invalidSource = new SimpleObjectDataSource([invalidData]);

      const handle = new ComponentHandle(invalidSource, 'invalid_comp');
      const result = handle.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be a string');
    });
  });

  describe('Projection methods', () => {
    test('dataModel() should return ComponentDataModelHandle', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const dataModelHandle = handle.dataModel();

      expect(dataModelHandle).toBeDefined();
      expect(dataModelHandle.entityName).toBe('state');
      expect(dataModelHandle.schema).toEqual({
        value: { type: 'string', description: 'Test value' }
      });
      expect(dataModelHandle.sampleData).toEqual({
        value: 'Hello'
      });
    });

    test('metadata() should return component metadata', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const metadata = handle.metadata();

      expect(metadata).toEqual({
        id: 'comp_123',
        name: 'TestComponent',
        description: 'A test component',
        author: 'human',
        tags: ['test'],
        created: '2025-10-04T12:00:00Z',
        modified: '2025-10-04T12:00:00Z',
        version: 1
      });
    });
  });

  describe('Property access', () => {
    test('should access component properties directly', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      const value = handle.value();

      expect(value.name).toBe('TestComponent');
      expect(value.description).toBe('A test component');
      expect(value.author).toBe('human');
      expect(value.tags).toEqual(['test']);
      expect(value.version).toBe(1);
    });
  });

  describe('query() method', () => {
    test('should execute query through dataSource', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');

      // Query for components with specific tag
      const result = handle.query({
        where: { tags: 'test' }
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    test('should throw error when accessing destroyed handle', () => {
      const handle = new ComponentHandle(dataSource, 'comp_123');
      handle.destroy();

      expect(() => handle.value()).toThrow();
    });
  });
});
