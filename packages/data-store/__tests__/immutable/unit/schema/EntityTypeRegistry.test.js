/**
 * Unit Tests for EntityTypeRegistry
 * Per implementation plan Phase 4 Step 4.2
 * TDD approach - tests written first before implementation
 */

import { EntityTypeRegistry } from '../../../../src/immutable/schema/EntityTypeRegistry.js';
import { EntityType } from '../../../../src/immutable/schema/EntityType.js';

describe('EntityTypeRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new EntityTypeRegistry();
  });

  describe('Constructor and Initialization', () => {
    test('should create empty registry', () => {
      expect(registry).toBeInstanceOf(EntityTypeRegistry);
      expect(registry.getTypeCount()).toBe(0);
      expect(registry.getAllTypes()).toEqual([]);
      expect(Object.isFrozen(registry)).toBe(true);
    });

    test('should create registry with initial types', () => {
      const personType = new EntityType('Person', {
        required: ['name'],
        types: { name: 'string' }
      });
      const companyType = new EntityType('Company', {
        required: ['name'],
        types: { name: 'string' }
      });

      const registryWithTypes = new EntityTypeRegistry([personType, companyType]);
      
      expect(registryWithTypes.getTypeCount()).toBe(2);
      expect(registryWithTypes.hasType('Person')).toBe(true);
      expect(registryWithTypes.hasType('Company')).toBe(true);
    });

    test('should be immutable', () => {
      expect(() => {
        registry.types = new Map();
      }).toThrow();
      
      expect(() => {
        registry._types.set('Test', 'value');
      }).toThrow();
    });

    test('should fail fast on invalid initialization', () => {
      expect(() => new EntityTypeRegistry('not-array'))
        .toThrow('Initial types must be an array');
      
      expect(() => new EntityTypeRegistry(['not-entity-type']))
        .toThrow('All initial types must be EntityType instances');
    });
  });

  describe('Type Registration and Lookup', () => {
    let personType, companyType;

    beforeEach(() => {
      personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      companyType = new EntityType('Company', {
        required: ['name', 'industry'],
        types: { name: 'string', industry: 'string' }
      });
    });

    test('should register entity type', () => {
      const newRegistry = registry.registerType(personType);
      
      expect(newRegistry).not.toBe(registry); // New instance
      expect(newRegistry.hasType('Person')).toBe(true);
      expect(newRegistry.getType('Person')).toBe(personType);
      expect(registry.hasType('Person')).toBe(false); // Original unchanged
    });

    test('should register multiple types', () => {
      const newRegistry = registry
        .registerType(personType)
        .registerType(companyType);
      
      expect(newRegistry.getTypeCount()).toBe(2);
      expect(newRegistry.hasType('Person')).toBe(true);
      expect(newRegistry.hasType('Company')).toBe(true);
    });

    test('should replace existing type with same name', () => {
      const updatedPersonType = new EntityType('Person', {
        required: ['name', 'age', 'email'],
        types: { name: 'string', age: 'number', email: 'string' }
      });

      const registry1 = registry.registerType(personType);
      const registry2 = registry1.registerType(updatedPersonType);
      
      expect(registry2.getType('Person')).toBe(updatedPersonType);
      expect(registry2.getType('Person').required).toEqual(['name', 'age', 'email']);
    });

    test('should lookup types by name', () => {
      const registryWithTypes = registry
        .registerType(personType)
        .registerType(companyType);
      
      expect(registryWithTypes.getType('Person')).toBe(personType);
      expect(registryWithTypes.getType('Company')).toBe(companyType);
      expect(registryWithTypes.getType('NonExistent')).toBeUndefined();
    });

    test('should unregister types', () => {
      const registryWithTypes = registry
        .registerType(personType)
        .registerType(companyType);
      
      const afterUnregister = registryWithTypes.unregisterType('Person');
      
      expect(afterUnregister.hasType('Person')).toBe(false);
      expect(afterUnregister.hasType('Company')).toBe(true);
      expect(afterUnregister.getTypeCount()).toBe(1);
    });

    test('should return same instance when unregistering non-existent type', () => {
      const result = registry.unregisterType('NonExistent');
      expect(result).toBe(registry);
    });

    test('should fail fast on invalid registration', () => {
      expect(() => registry.registerType(null))
        .toThrow('Type is required');
      
      expect(() => registry.registerType('not-entity-type'))
        .toThrow('Type must be an EntityType instance');
    });
  });

  describe('Schema Validation', () => {
    let registry;

    beforeEach(() => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });
      const companyType = new EntityType('Company', {
        required: ['name'],
        types: { name: 'string' }
      });
      
      registry = new EntityTypeRegistry([personType, companyType]);
    });

    test('should validate entity against registered type', () => {
      const person = { name: 'Alice', age: 30 };
      const result = registry.validateEntity('Person', person);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation for invalid entity', () => {
      const invalidPerson = { name: 'Alice' }; // Missing age
      const result = registry.validateEntity('Person', invalidPerson);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_required');
    });

    test('should return error for unregistered type', () => {
      const entity = { field: 'value' };
      const result = registry.validateEntity('UnknownType', entity);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('unknown_type');
      expect(result.errors[0].message).toContain('Unknown entity type: UnknownType');
    });

    test('should batch validate multiple entities', () => {
      const entities = [
        { type: 'Person', entity: { name: 'Alice', age: 30 } },
        { type: 'Person', entity: { name: 'Bob' } }, // Invalid
        { type: 'Company', entity: { name: 'Acme' } },
        { type: 'Unknown', entity: { field: 'value' } } // Unknown type
      ];

      const results = registry.validateBatch(entities);
      
      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
    });
  });

  describe('Type Inheritance Support', () => {
    test('should handle type inheritance chains', () => {
      const animalType = new EntityType('Animal', {
        required: ['name'],
        types: { name: 'string' }
      });

      const mammalType = animalType.extend('Mammal', {
        required: ['furColor'],
        types: { furColor: 'string' }
      });

      const dogType = mammalType.extend('Dog', {
        required: ['breed'],
        types: { breed: 'string' }
      });

      const registryWithTypes = new EntityTypeRegistry()
        .registerType(animalType)
        .registerType(mammalType)
        .registerType(dogType);

      // Get inheritance chain
      const chain = registryWithTypes.getInheritanceChain('Dog');
      
      expect(chain).toHaveLength(3);
      expect(chain[0].name).toBe('Dog');
      expect(chain[1].name).toBe('Mammal');
      expect(chain[2].name).toBe('Animal');
    });

    test('should find all subtypes of a type', () => {
      const animalType = new EntityType('Animal');
      const mammalType = animalType.extend('Mammal');
      const birdType = animalType.extend('Bird');
      const dogType = mammalType.extend('Dog');
      const catType = mammalType.extend('Cat');

      const registry = new EntityTypeRegistry()
        .registerType(animalType)
        .registerType(mammalType)
        .registerType(birdType)
        .registerType(dogType)
        .registerType(catType);

      const animalSubtypes = registry.getSubtypes('Animal');
      expect(animalSubtypes).toHaveLength(4);
      expect(animalSubtypes.map(t => t.name).sort()).toEqual(['Bird', 'Cat', 'Dog', 'Mammal']);

      const mammalSubtypes = registry.getSubtypes('Mammal');
      expect(mammalSubtypes).toHaveLength(2);
      expect(mammalSubtypes.map(t => t.name).sort()).toEqual(['Cat', 'Dog']);
    });
  });

  describe('Type Queries and Utilities', () => {
    let registryWithTypes;

    beforeEach(() => {
      const types = [
        new EntityType('Person', { required: ['name'] }),
        new EntityType('Company', { required: ['name', 'industry'] }),
        new EntityType('Project', { required: ['title', 'budget'] })
      ];
      registryWithTypes = new EntityTypeRegistry(types);
    });

    test('should list all type names', () => {
      const names = registryWithTypes.getTypeNames();
      
      expect(names).toHaveLength(3);
      expect(names.sort()).toEqual(['Company', 'Person', 'Project']);
    });

    test('should get all types', () => {
      const types = registryWithTypes.getAllTypes();
      
      expect(types).toHaveLength(3);
      expect(types.every(t => t instanceof EntityType)).toBe(true);
    });

    test('should find types by predicate', () => {
      const typesWithName = registryWithTypes.findTypes(type => 
        type.required.includes('name')
      );
      
      expect(typesWithName).toHaveLength(2);
      expect(typesWithName.map(t => t.name).sort()).toEqual(['Company', 'Person']);
    });

    test('should provide registry statistics', () => {
      const stats = registryWithTypes.getStatistics();
      
      expect(stats).toEqual({
        totalTypes: 3,
        typesWithInheritance: 0,
        averageRequiredFields: 5/3, // (1 + 2 + 2) / 3
        averageOptionalFields: 0
      });
    });

    test('should provide meaningful string representation', () => {
      const str = registryWithTypes.toString();
      
      expect(str).toContain('EntityTypeRegistry');
      expect(str).toContain('3 types');
    });

    test('should serialize to JSON', () => {
      const json = registryWithTypes.toJSON();
      
      expect(json).toHaveProperty('types');
      expect(json.types).toHaveLength(3);
      expect(json.types[0]).toHaveProperty('name');
      expect(json.types[0]).toHaveProperty('required');
    });
  });

  describe('Clear and Reset', () => {
    test('should clear all types', () => {
      const registryWithTypes = new EntityTypeRegistry()
        .registerType(new EntityType('Type1'))
        .registerType(new EntityType('Type2'));
      
      const clearedRegistry = registryWithTypes.clear();
      
      expect(clearedRegistry.getTypeCount()).toBe(0);
      expect(clearedRegistry.getAllTypes()).toEqual([]);
      expect(registryWithTypes.getTypeCount()).toBe(2); // Original unchanged
    });

    test('should batch register multiple types', () => {
      const types = [
        new EntityType('Type1'),
        new EntityType('Type2'),
        new EntityType('Type3')
      ];

      const newRegistry = registry.registerBatch(types);
      
      expect(newRegistry.getTypeCount()).toBe(3);
      expect(newRegistry.hasType('Type1')).toBe(true);
      expect(newRegistry.hasType('Type2')).toBe(true);
      expect(newRegistry.hasType('Type3')).toBe(true);
    });

    test('should fail fast on invalid batch registration', () => {
      expect(() => registry.registerBatch('not-array'))
        .toThrow('Types must be an array');
      
      expect(() => registry.registerBatch(['not-entity-type']))
        .toThrow('All types must be EntityType instances');
    });
  });
});