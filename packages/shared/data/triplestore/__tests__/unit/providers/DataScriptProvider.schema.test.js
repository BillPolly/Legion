import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';
import { ValidationError } from '../../../src/core/StorageError.js';

describe('DataScriptProvider - Schema Handling', () => {
  describe('Schema Initialization', () => {
    it('should initialize with empty schema', () => {
      const provider = new DataScriptProvider();
      expect(provider).toBeDefined();
      expect(provider.getMetadata().type).toBe('datascript');
      expect(provider.getMetadata().supportsTransactions).toBe(true);
    });

    it('should initialize with basic triple schema', () => {
      const schema = {
        ':triple/subject': { ':db/cardinality': ':db.cardinality/one' },
        ':triple/predicate': { ':db/cardinality': ':db.cardinality/one' },
        ':triple/object': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider).toBeDefined();
      expect(provider.schema).toEqual(expect.objectContaining(schema));
    });

    it('should add default triple schema attributes', () => {
      const provider = new DataScriptProvider();
      
      // Should have default triple attributes
      expect(provider.schema).toHaveProperty(':triple/subject');
      expect(provider.schema).toHaveProperty(':triple/predicate');
      expect(provider.schema).toHaveProperty(':triple/object');
      expect(provider.schema).toHaveProperty(':triple/id');
    });

    it('should handle schema with cardinality specifications', () => {
      const schema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/friends': { ':db/cardinality': ':db.cardinality/many' },
        ':person/age': { ':db/cardinality': ':db.cardinality/one', ':db/valueType': ':db.type/long' }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema).toEqual(expect.objectContaining(schema));
    });

    it('should handle schema with unique constraints', () => {
      const schema = {
        ':user/email': { 
          ':db/unique': ':db.unique/identity',
          ':db/cardinality': ':db.cardinality/one' 
        },
        ':user/username': { 
          ':db/unique': ':db.unique/value',
          ':db/cardinality': ':db.cardinality/one' 
        }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema).toEqual(expect.objectContaining(schema));
    });

    it('should merge user schema with default triple schema', () => {
      const userSchema = {
        ':custom/attribute': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema: userSchema });
      
      // Should have both user and default schemas
      expect(provider.schema).toHaveProperty(':custom/attribute');
      expect(provider.schema).toHaveProperty(':triple/subject');
      expect(provider.schema).toHaveProperty(':triple/predicate');
      expect(provider.schema).toHaveProperty(':triple/object');
    });

    it('should handle schema with reference types', () => {
      const schema = {
        ':book/author': { 
          ':db/valueType': ':db.type/ref',
          ':db/cardinality': ':db.cardinality/one' 
        },
        ':book/tags': { 
          ':db/valueType': ':db.type/ref',
          ':db/cardinality': ':db.cardinality/many' 
        }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema).toEqual(expect.objectContaining(schema));
    });

    it('should handle schema with all DataScript value types', () => {
      const schema = {
        ':test/string': { ':db/valueType': ':db.type/string' },
        ':test/boolean': { ':db/valueType': ':db.type/boolean' },
        ':test/long': { ':db/valueType': ':db.type/long' },
        ':test/bigint': { ':db/valueType': ':db.type/bigint' },
        ':test/float': { ':db/valueType': ':db.type/float' },
        ':test/double': { ':db/valueType': ':db.type/double' },
        ':test/instant': { ':db/valueType': ':db.type/instant' },
        ':test/uuid': { ':db/valueType': ':db.type/uuid' },
        ':test/uri': { ':db/valueType': ':db.type/uri' },
        ':test/keyword': { ':db/valueType': ':db.type/keyword' },
        ':test/ref': { ':db/valueType': ':db.type/ref' }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema).toEqual(expect.objectContaining(schema));
    });

    it('should clean prototype pollution from schema objects', () => {
      // Simulate prototype pollution that might exist in the environment
      const pollutedSchema = Object.create({ pollutedProp: 'should not appear' });
      pollutedSchema[':custom/attr'] = { ':db/cardinality': ':db.cardinality/one' };
      
      const provider = new DataScriptProvider({ schema: pollutedSchema });
      
      // Should not have the polluted property
      expect(provider.schema.pollutedProp).toBeUndefined();
      // Should have the actual schema property
      expect(provider.schema).toHaveProperty(':custom/attr');
    });

    it('should handle component attributes in schema', () => {
      const schema = {
        ':person/address': { ':db/isComponent': true },
        ':address/street': { ':db/cardinality': ':db.cardinality/one' },
        ':address/city': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema[':person/address']).toHaveProperty(':db/isComponent', true);
    });

    it('should handle indexed attributes in schema', () => {
      const schema = {
        ':person/name': { 
          ':db/index': true,
          ':db/cardinality': ':db.cardinality/one' 
        }
      };
      
      const provider = new DataScriptProvider({ schema });
      expect(provider.schema[':person/name']).toHaveProperty(':db/index', true);
    });
  });

  describe('Schema Validation', () => {
    it('should validate schema attribute names', () => {
      const invalidSchema = {
        'invalid-attr': { ':db/cardinality': ':db.cardinality/one' } // Missing namespace
      };
      
      expect(() => {
        new DataScriptProvider({ schema: invalidSchema, validateSchema: true });
      }).toThrow(ValidationError);
    });

    it('should validate cardinality values', () => {
      const invalidSchema = {
        ':test/attr': { ':db/cardinality': 'invalid-cardinality' }
      };
      
      expect(() => {
        new DataScriptProvider({ schema: invalidSchema, validateSchema: true });
      }).toThrow(ValidationError);
    });

    it('should validate unique constraint values', () => {
      const invalidSchema = {
        ':test/attr': { ':db/unique': 'invalid-unique-type' }
      };
      
      expect(() => {
        new DataScriptProvider({ schema: invalidSchema, validateSchema: true });
      }).toThrow(ValidationError);
    });

    it('should validate value type specifications', () => {
      const invalidSchema = {
        ':test/attr': { ':db/valueType': 'invalid-type' }
      };
      
      expect(() => {
        new DataScriptProvider({ schema: invalidSchema, validateSchema: true });
      }).toThrow(ValidationError);
    });

    it('should allow disabling schema validation', () => {
      const invalidSchema = {
        'invalid-attr': { ':db/cardinality': 'invalid-cardinality' }
      };
      
      // Should not throw when validation is disabled
      const provider = new DataScriptProvider({ 
        schema: invalidSchema, 
        validateSchema: false 
      });
      expect(provider).toBeDefined();
    });
  });

  describe('Schema Evolution', () => {
    it('should support adding new attributes to existing schema', async () => {
      const initialSchema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema: initialSchema });
      
      // Add a triple first
      await provider.addTriple('person:1', 'name', 'Alice');
      
      // Evolve schema (in DataScript, this typically requires migration)
      const newAttribute = {
        ':person/email': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      provider.extendSchema(newAttribute);
      
      // Should be able to use new attribute
      await provider.addTriple('person:1', 'email', 'alice@example.com');
      
      const results = await provider.query('person:1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should preserve data when schema is extended', async () => {
      const provider = new DataScriptProvider();
      
      // Add data with default schema
      await provider.addTriple('entity:1', 'prop1', 'value1');
      
      // Extend schema
      provider.extendSchema({
        ':custom/newAttr': { ':db/cardinality': ':db.cardinality/one' }
      });
      
      // Original data should still be there
      const results = await provider.query('entity:1', 'prop1', null);
      expect(results).toEqual([['entity:1', 'prop1', 'value1']]);
    });
  });

  describe('Schema Introspection', () => {
    it('should provide schema metadata through getMetadata', () => {
      const schema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/age': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema });
      const metadata = provider.getMetadata();
      
      expect(metadata).toHaveProperty('schema');
      expect(metadata.schema).toHaveProperty(':person/name');
      expect(metadata.schema).toHaveProperty(':person/age');
    });

    it('should return schema attribute count', () => {
      const schema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/age': { ':db/cardinality': ':db.cardinality/one' },
        ':person/email': { ':db/cardinality': ':db.cardinality/one' }
      };
      
      const provider = new DataScriptProvider({ schema });
      const metadata = provider.getMetadata();
      
      // Count includes user schema + default triple schema
      const schemaKeys = Object.keys(metadata.schema);
      expect(schemaKeys.length).toBeGreaterThanOrEqual(3);
    });

    it('should identify schema capabilities', () => {
      const provider = new DataScriptProvider();
      const metadata = provider.getMetadata();
      
      expect(metadata.capabilities).toEqual(expect.objectContaining({
        transactions: true,
        datalog: true,
        pull: true,
        history: false, // DataScript doesn't have built-in history
        rules: true
      }));
    });
  });
});