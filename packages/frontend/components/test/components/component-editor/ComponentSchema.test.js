/**
 * Component Data Model Schema Tests - Phase 1.2
 *
 * Tests for component data structure validation and data model schema validation
 */

import { ComponentSchema, DataModelSchema } from '../../../src/components/component-editor/src/schemas/ComponentSchema.js';

describe('ComponentSchema', () => {
  describe('Valid Component Data', () => {
    test('should validate minimal component data', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'TestComponent :: state => div.test { "Hello" }',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate complete component data', () => {
      const componentData = {
        id: 'component_123',
        name: 'UserProfileCard',
        description: 'Displays user profile',
        dsl: 'UserProfileCard :: user => div.profile { user.name }',
        cnl: 'Define UserProfileCard with user: A div showing user name',
        json: {
          name: 'UserProfileCard',
          entity: 'user',
          structure: {},
          bindings: []
        },
        dataModel: {
          entityName: 'user',
          schema: {
            name: { type: 'string', description: 'User name' }
          },
          sampleData: {
            name: 'John Doe'
          }
        },
        author: 'human',
        authorDetails: {
          type: 'human',
          userId: 'user_123',
          name: 'Alice'
        },
        tags: ['profile', 'user'],
        category: 'user-interface',
        created: '2025-10-04T12:00:00Z',
        modified: '2025-10-04T14:00:00Z',
        version: 1,
        tests: []
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Invalid Component Data', () => {
    test('should reject component without name', () => {
      const componentData = {
        dsl: 'Component :: state => div.test',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name is required');
    });

    test('should reject component without dsl', () => {
      const componentData = {
        name: 'TestComponent',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dsl is required');
    });

    test('should reject component without dataModel', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'TestComponent :: state => div.test'
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dataModel is required');
    });

    test('should reject component with invalid name type', () => {
      const componentData = {
        name: 123,
        dsl: 'Component :: state => div.test',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be a string');
    });

    test('should reject component with invalid tags type', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'Component :: state => div.test',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        },
        tags: 'not-an-array'
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('tags must be an array');
    });

    test('should reject component with invalid author type', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'Component :: state => div.test',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        },
        author: 'invalid-author-type'
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('author must be one of: human, ai, collaborative');
    });
  });

  describe('Nested DataModel Validation', () => {
    test('should reject component with invalid dataModel', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'Component :: state => div.test',
        dataModel: 'not-an-object'
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dataModel must be an object');
    });

    test('should reject dataModel without entityName', () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'Component :: state => div.test',
        dataModel: {
          schema: {},
          sampleData: {}
        }
      };

      const result = ComponentSchema.validate(componentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dataModel.entityName is required');
    });
  });
});

describe('DataModelSchema', () => {
  describe('Valid Data Model', () => {
    test('should validate minimal data model', () => {
      const dataModel = {
        entityName: 'user',
        schema: {},
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate data model with fields', () => {
      const dataModel = {
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

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Invalid Data Model', () => {
    test('should reject data model without entityName', () => {
      const dataModel = {
        schema: {},
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('entityName is required');
    });

    test('should reject data model without schema', () => {
      const dataModel = {
        entityName: 'user',
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('schema is required');
    });

    test('should reject data model without sampleData', () => {
      const dataModel = {
        entityName: 'user',
        schema: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sampleData is required');
    });

    test('should reject data model with invalid entityName type', () => {
      const dataModel = {
        entityName: 123,
        schema: {},
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('entityName must be a string');
    });

    test('should reject data model with invalid schema type', () => {
      const dataModel = {
        entityName: 'user',
        schema: 'not-an-object',
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('schema must be an object');
    });

    test('should reject data model with invalid field definition', () => {
      const dataModel = {
        entityName: 'user',
        schema: {
          name: { type: 'invalid-type', description: 'User name' }
        },
        sampleData: {}
      };

      const result = DataModelSchema.validate(dataModel);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('schema.name.type must be one of: string, number, boolean, array, object, date');
    });
  });
});
