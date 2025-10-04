/**
 * ComponentDataModelHandle Tests - Phase 1.4
 *
 * Tests for ComponentDataModelHandle class implementation
 */

import { ComponentDataModelHandle } from '../../../src/components/component-editor/src/handles/ComponentDataModelHandle.js';

describe('ComponentDataModelHandle', () => {
  let dataModelData;

  beforeEach(() => {
    dataModelData = {
      entityName: 'user',
      schema: {
        name: { type: 'string', description: 'User name' },
        age: { type: 'number', description: 'User age' },
        active: { type: 'boolean', description: 'Is active' }
      },
      sampleData: {
        name: 'John Doe',
        age: 30,
        active: true
      }
    };
  });

  describe('Constructor and Properties', () => {
    test('should create ComponentDataModelHandle with data', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      expect(handle).toBeInstanceOf(ComponentDataModelHandle);
      expect(handle.entityName).toBe('user');
      expect(handle.schema).toEqual(dataModelData.schema);
      expect(handle.sampleData).toEqual(dataModelData.sampleData);
    });

    test('should provide access to entityName', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      expect(handle.entityName).toBe('user');
    });

    test('should provide access to schema', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      expect(handle.schema).toEqual({
        name: { type: 'string', description: 'User name' },
        age: { type: 'number', description: 'User age' },
        active: { type: 'boolean', description: 'Is active' }
      });
    });

    test('should provide access to sampleData', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      expect(handle.sampleData).toEqual({
        name: 'John Doe',
        age: 30,
        active: true
      });
    });
  });

  describe('Schema Operations', () => {
    test('addField() should add new field to schema', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.addField('email', 'string', 'User email');

      expect(handle.schema.email).toEqual({
        type: 'string',
        description: 'User email'
      });
    });

    test('addField() should create schema object if missing', () => {
      const handle = new ComponentDataModelHandle({ entityName: 'test', sampleData: {} });
      handle.addField('field1', 'string', 'Test field');

      expect(handle.schema).toBeDefined();
      expect(handle.schema.field1).toEqual({
        type: 'string',
        description: 'Test field'
      });
    });

    test('removeField() should remove field from schema', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.removeField('age');

      expect(handle.schema.age).toBeUndefined();
    });

    test('removeField() should also remove field from sampleData', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.removeField('age');

      expect(handle.schema.age).toBeUndefined();
      expect(handle.sampleData.age).toBeUndefined();
    });

    test('updateField() should update existing field definition', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.updateField('name', { description: 'Updated description', required: true });

      expect(handle.schema.name).toEqual({
        type: 'string',
        description: 'Updated description',
        required: true
      });
    });

    test('updateField() should preserve existing properties when updating', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.updateField('name', { required: true });

      expect(handle.schema.name.type).toBe('string');
      expect(handle.schema.name.description).toBe('User name');
      expect(handle.schema.name.required).toBe(true);
    });
  });

  describe('Sample Data Operations', () => {
    test('updateSampleData() should update sample data', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.updateSampleData({ name: 'Jane Doe', age: 25 });

      expect(handle.sampleData.name).toBe('Jane Doe');
      expect(handle.sampleData.age).toBe(25);
      expect(handle.sampleData.active).toBe(true); // Preserved
    });

    test('updateSampleData() should merge with existing data', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      handle.updateSampleData({ email: 'test@example.com' });

      expect(handle.sampleData.name).toBe('John Doe');
      expect(handle.sampleData.age).toBe(30);
      expect(handle.sampleData.email).toBe('test@example.com');
    });
  });

  describe('Data Validation', () => {
    test('validateData() should accept valid data', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.validateData({
        name: 'Test User',
        age: 25,
        active: false
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validateData() should detect type mismatch for string field', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.validateData({
        name: 123,
        age: 25,
        active: true
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "name" must be a string');
    });

    test('validateData() should detect type mismatch for number field', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.validateData({
        name: 'Test',
        age: 'not a number',
        active: true
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "age" must be a number');
    });

    test('validateData() should detect type mismatch for boolean field', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.validateData({
        name: 'Test',
        age: 25,
        active: 'yes'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "active" must be a boolean');
    });

    test('validateData() should validate array types', () => {
      const arraySchema = {
        entityName: 'test',
        schema: {
          tags: { type: 'array', description: 'Tags' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(arraySchema);
      const result = handle.validateData({ tags: 'not-array' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "tags" must be an array');
    });

    test('validateData() should validate object types', () => {
      const objectSchema = {
        entityName: 'test',
        schema: {
          metadata: { type: 'object', description: 'Metadata' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(objectSchema);
      const result = handle.validateData({ metadata: 'not-object' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "metadata" must be an object');
    });

    test('validateData() should check required fields', () => {
      const requiredSchema = {
        entityName: 'test',
        schema: {
          name: { type: 'string', description: 'Name', required: true },
          age: { type: 'number', description: 'Age' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(requiredSchema);
      const result = handle.validateData({ age: 25 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "name" is required');
    });

    test('validateData() should allow unknown fields', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.validateData({
        name: 'Test',
        age: 25,
        active: true,
        unknownField: 'value'
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Sample Data Generation', () => {
    test('generateSampleData() should generate sample data from schema', () => {
      const schema = {
        entityName: 'product',
        schema: {
          name: { type: 'string' },
          price: { type: 'number' },
          inStock: { type: 'boolean' },
          tags: { type: 'array' },
          metadata: { type: 'object' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(schema);
      const generated = handle.generateSampleData();

      expect(generated.name).toBe('Sample name');
      expect(generated.price).toBe(0);
      expect(generated.inStock).toBe(false);
      expect(generated.tags).toEqual([]);
      expect(generated.metadata).toEqual({});
    });

    test('generateSampleData() should generate date values', () => {
      const schema = {
        entityName: 'event',
        schema: {
          timestamp: { type: 'date' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(schema);
      const generated = handle.generateSampleData();

      expect(typeof generated.timestamp).toBe('string');
      expect(new Date(generated.timestamp)).not.toBe('Invalid Date');
    });

    test('generateSampleData() should update internal sampleData', () => {
      const schema = {
        entityName: 'test',
        schema: {
          field1: { type: 'string' }
        },
        sampleData: {}
      };

      const handle = new ComponentDataModelHandle(schema);
      handle.generateSampleData();

      expect(handle.sampleData.field1).toBe('Sample field1');
    });
  });

  describe('Method Chaining', () => {
    test('addField() should return this for chaining', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.addField('email', 'string', 'Email');

      expect(result).toBe(handle);
    });

    test('removeField() should return this for chaining', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.removeField('age');

      expect(result).toBe(handle);
    });

    test('updateField() should return this for chaining', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.updateField('name', { required: true });

      expect(result).toBe(handle);
    });

    test('updateSampleData() should return this for chaining', () => {
      const handle = new ComponentDataModelHandle(dataModelData);
      const result = handle.updateSampleData({ name: 'New Name' });

      expect(result).toBe(handle);
    });

    test('should support method chaining for multiple operations', () => {
      const handle = new ComponentDataModelHandle(dataModelData);

      handle
        .addField('email', 'string', 'Email')
        .updateField('name', { required: true })
        .updateSampleData({ email: 'test@example.com' })
        .removeField('active');

      expect(handle.schema.email).toBeDefined();
      expect(handle.schema.name.required).toBe(true);
      expect(handle.sampleData.email).toBe('test@example.com');
      expect(handle.schema.active).toBeUndefined();
    });
  });
});
