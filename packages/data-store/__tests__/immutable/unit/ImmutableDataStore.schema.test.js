/**
 * Unit Tests for ImmutableDataStore Schema Integration
 * Per implementation plan Phase 4 Step 4.4
 * TDD approach - tests written first before implementation
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { EntityType } from '../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../src/immutable/schema/EntityTypeRegistry.js';
import { SchemaConstraintGenerator } from '../../../src/immutable/schema/SchemaConstraintGenerator.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';
import { ConstraintViolationError } from '../../../src/immutable/ConstraintViolationError.js';

describe('ImmutableDataStore Schema Integration', () => {
  let store;

  beforeEach(() => {
    store = new ImmutableDataStore();
  });

  describe('Schema Registration', () => {
    test('should create store with entity type registry', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      const companyType = new EntityType('Company', {
        required: ['name'],
        types: { name: 'string' }
      });

      const registry = new EntityTypeRegistry([personType, companyType]);
      const storeWithSchema = new ImmutableDataStore({ entityTypeRegistry: registry });

      expect(storeWithSchema.getEntityTypeRegistry()).toBe(registry);
      expect(storeWithSchema.hasEntityType('Person')).toBe(true);
      expect(storeWithSchema.hasEntityType('Company')).toBe(true);
    });

    test('should register entity types dynamically', () => {
      const personType = new EntityType('Person', {
        required: ['name'],
        types: { name: 'string' }
      });

      const newStore = store.registerEntityType(personType);
      
      expect(newStore).not.toBe(store); // New instance
      expect(newStore.hasEntityType('Person')).toBe(true);
      expect(newStore.getEntityType('Person')).toBe(personType);
      expect(store.hasEntityType('Person')).toBe(false); // Original unchanged
    });

    test('should register multiple entity types', () => {
      const types = [
        new EntityType('Person', { required: ['name'] }),
        new EntityType('Company', { required: ['name'] }),
        new EntityType('Project', { required: ['title'] })
      ];

      const newStore = store.registerEntityTypes(types);
      
      expect(newStore.hasEntityType('Person')).toBe(true);
      expect(newStore.hasEntityType('Company')).toBe(true);
      expect(newStore.hasEntityType('Project')).toBe(true);
    });
  });

  describe('Schema-Driven Validation', () => {
    let storeWithSchema;

    beforeEach(() => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' },
        constraints: {
          age: { min: 0, max: 150 }
        }
      });
      
      const companyType = new EntityType('Company', {
        required: ['name', 'industry'],
        types: { name: 'string', industry: 'string' }
      });

      const registry = new EntityTypeRegistry([personType, companyType]);
      storeWithSchema = new ImmutableDataStore({ 
        entityTypeRegistry: registry,
        enableSchemaValidation: true 
      });
    });

    test('should validate entities against registered schemas when adding edges', () => {
      // Set entity metadata with valid attributes
      const store1 = storeWithSchema
        .withEntityType('alice', 'Person', { name: 'Alice', age: 30 })
        .withEntityType('acme', 'Company', { name: 'Acme Corp', industry: 'Tech' });

      // This should succeed
      const edge = new Edge('worksAt', 'alice', 'acme');
      const store2 = store1.addEdge(edge);
      
      expect(store2.hasEdge(edge)).toBe(true);
    });

    test('should fail when entity attributes violate schema', () => {
      // Invalid age (negative)
      expect(() => {
        storeWithSchema.withEntityType('alice', 'Person', { name: 'Alice', age: -5 });
      }).toThrow('Entity attributes do not match schema for type Person');
    });

    test('should fail when required attributes are missing', () => {
      // Missing required 'age' field
      expect(() => {
        storeWithSchema.withEntityType('alice', 'Person', { name: 'Alice' });
      }).toThrow('Entity attributes do not match schema for type Person');
    });

    test('should skip validation when enableSchemaValidation is false', () => {
      const registry = new EntityTypeRegistry([
        new EntityType('Person', { required: ['name', 'age'] })
      ]);
      
      const nonValidatingStore = new ImmutableDataStore({ 
        entityTypeRegistry: registry,
        enableSchemaValidation: false 
      });

      // Missing age - would normally fail
      const store1 = nonValidatingStore
        .withEntityType('alice', 'Person', { name: 'Alice' });

      const edge = new Edge('worksAt', 'alice', 'company1');
      const store2 = store1.addEdge(edge);
      
      expect(store2.hasEdge(edge)).toBe(true); // Should succeed without validation
    });
  });

  describe('Automatic Constraint Generation', () => {
    test('should automatically generate constraints from relationship schemas', () => {
      const personType = new EntityType('Person');
      const companyType = new EntityType('Company');
      const projectType = new EntityType('Project');

      const registry = new EntityTypeRegistry([personType, companyType, projectType]);

      // Define relationship schema
      const relationshipSchema = {
        'worksAt': { source: 'Person', target: 'Company' },
        'manages': { source: 'Person', target: 'Project' }
      };

      const storeWithConstraints = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: relationshipSchema,
        generateSchemaConstraints: true
      });

      // Verify constraints were generated
      const constraints = storeWithConstraints.getConstraints();
      const constraintIds = constraints.map(c => c.id);
      
      expect(constraintIds).toContain('schema-worksAt-source-Person');
      expect(constraintIds).toContain('schema-worksAt-target-Company');
      expect(constraintIds).toContain('schema-manages-source-Person');
      expect(constraintIds).toContain('schema-manages-target-Project');
    });

    test('should enforce auto-generated entity type constraints', () => {
      const personType = new EntityType('Person');
      const companyType = new EntityType('Company');
      const registry = new EntityTypeRegistry([personType, companyType]);

      const relationshipSchema = {
        'worksAt': { source: 'Person', target: 'Company' }
      };

      const store1 = new ImmutableDataStore({
        entityTypeRegistry: registry,
        relationshipSchema: relationshipSchema,
        generateSchemaConstraints: true
      });

      // Set up entities
      const store2 = store1
        .withEntityType('alice', 'Person')
        .withEntityType('bob', 'Person')
        .withEntityType('acme', 'Company')
        .withEntityType('project1', 'Project'); // Wrong type

      // Valid edge - Person -> Company
      const validEdge = new Edge('worksAt', 'alice', 'acme');
      const store3 = store2.addEdge(validEdge);
      expect(store3.hasEdge(validEdge)).toBe(true);

      // Invalid edge - Person -> Project (should be Company)
      const invalidEdge = new Edge('worksAt', 'bob', 'project1');
      expect(() => store3.addEdge(invalidEdge))
        .toThrow(ConstraintViolationError);
    });

    test('should generate attribute validation constraints', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'email'],
        types: { 
          name: 'string',
          email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        }
      });

      const registry = new EntityTypeRegistry([personType]);
      
      const store1 = new ImmutableDataStore({
        entityTypeRegistry: registry,
        generateSchemaConstraints: true,
        generateAttributeConstraints: true
      });

      // Valid entity
      const store2 = store1.withEntityType('alice', 'Person', {
        name: 'Alice',
        email: 'alice@example.com'
      });
      
      const validEdge = new Edge('knows', 'alice', 'bob');
      const store3 = store2.addEdge(validEdge);
      expect(store3.hasEdge(validEdge)).toBe(true);

      // Invalid entity - bad email
      const store4 = store3.withEntityType('charlie', 'Person', {
        name: 'Charlie',
        email: 'not-an-email'
      });

      const invalidEdge = new Edge('knows', 'charlie', 'alice');
      expect(() => store4.addEdge(invalidEdge))
        .toThrow(ConstraintViolationError);
    });
  });

  describe('Schema Methods', () => {
    let storeWithSchema;

    beforeEach(() => {
      const registry = new EntityTypeRegistry([
        new EntityType('Person'),
        new EntityType('Company')
      ]);
      storeWithSchema = new ImmutableDataStore({ entityTypeRegistry: registry });
    });

    test('should provide entity type access methods', () => {
      expect(storeWithSchema.hasEntityType('Person')).toBe(true);
      expect(storeWithSchema.hasEntityType('Unknown')).toBe(false);
      
      const personType = storeWithSchema.getEntityType('Person');
      expect(personType).toBeInstanceOf(EntityType);
      expect(personType.name).toBe('Person');
      
      expect(storeWithSchema.getEntityType('Unknown')).toBeUndefined();
    });

    test('should list all entity types', () => {
      const types = storeWithSchema.getAllEntityTypes();
      expect(types).toHaveLength(2);
      expect(types.every(t => t instanceof EntityType)).toBe(true);
      
      const typeNames = storeWithSchema.getEntityTypeNames();
      expect(typeNames).toEqual(['Company', 'Person']);
    });

    test('should validate entity against schema', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      
      const store1 = store.registerEntityType(personType);
      
      // Valid entity
      const validResult = store1.validateEntityAgainstSchema('Person', {
        name: 'Alice',
        age: 30
      });
      expect(validResult.isValid).toBe(true);
      
      // Invalid entity
      const invalidResult = store1.validateEntityAgainstSchema('Person', {
        name: 'Bob'
        // Missing age
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0].type).toBe('missing_required');
    });

    test('should generate schema report', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        optional: ['email']
      });
      const companyType = new EntityType('Company', {
        required: ['name', 'industry']
      });
      
      const registry = new EntityTypeRegistry([personType, companyType]);
      const store1 = new ImmutableDataStore({ 
        entityTypeRegistry: registry,
        relationshipSchema: {
          'worksAt': { source: 'Person', target: 'Company' }
        }
      });
      
      const report = store1.getSchemaReport();
      
      expect(report).toHaveProperty('entityTypes');
      expect(report.entityTypes).toHaveLength(2);
      expect(report).toHaveProperty('relationships');
      expect(report.relationships).toHaveProperty('worksAt');
      expect(report).toHaveProperty('statistics');
      expect(report.statistics.totalEntityTypes).toBe(2);
      expect(report.statistics.totalRelationships).toBe(1);
    });
  });

  describe('withEntityType Enhanced', () => {
    test('should validate attributes when setting entity type with schema', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      
      const store1 = store
        .registerEntityType(personType)
        .enableSchemaValidation();
      
      // Valid attributes
      const store2 = store1.withEntityType('alice', 'Person', {
        name: 'Alice',
        age: 30
      });
      
      expect(store2.getEntityMetadata('alice')).toEqual({
        type: 'Person',
        attributes: { name: 'Alice', age: 30 }
      });
      
      // Invalid attributes - should throw
      expect(() => {
        store1.withEntityType('bob', 'Person', {
          name: 'Bob',
          age: 'thirty' // Wrong type
        });
      }).toThrow('Entity attributes do not match schema for type Person');
    });

    test('should allow setting entity type without validation when disabled', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      
      const store1 = store
        .registerEntityType(personType)
        .disableSchemaValidation();
      
      // Invalid attributes but validation disabled
      const store2 = store1.withEntityType('bob', 'Person', {
        name: 'Bob'
        // Missing age
      });
      
      expect(store2.getEntityMetadata('bob')).toEqual({
        type: 'Person',
        attributes: { name: 'Bob' }
      });
    });
  });

  describe('Schema Evolution', () => {
    test('should update entity type definition', () => {
      const personV1 = new EntityType('Person', {
        required: ['name']
      });
      
      const store1 = store.registerEntityType(personV1);
      
      // Update with new version
      const personV2 = new EntityType('Person', {
        required: ['name', 'email'],
        types: { name: 'string', email: 'string' }
      });
      
      const store2 = store1.registerEntityType(personV2);
      
      const personType = store2.getEntityType('Person');
      expect(personType.required).toEqual(['name', 'email']);
    });

    test('should unregister entity type', () => {
      const store1 = store
        .registerEntityType(new EntityType('Person'))
        .registerEntityType(new EntityType('Company'));
      
      expect(store1.hasEntityType('Person')).toBe(true);
      
      const store2 = store1.unregisterEntityType('Person');
      
      expect(store2.hasEntityType('Person')).toBe(false);
      expect(store2.hasEntityType('Company')).toBe(true);
    });
  });
});