/**
 * Unit Tests for SchemaConstraintGenerator
 * Per implementation plan Phase 4 Step 4.3
 * TDD approach - tests written first before implementation
 */

import { SchemaConstraintGenerator } from '../../../../src/immutable/schema/SchemaConstraintGenerator.js';
import { EntityType } from '../../../../src/immutable/schema/EntityType.js';
import { EntityTypeRegistry } from '../../../../src/immutable/schema/EntityTypeRegistry.js';
import { Constraint } from '../../../../src/immutable/constraints/Constraint.js';
import { EntityTypeConstraint } from '../../../../src/immutable/constraints/EntityTypeConstraint.js';
import { CustomConstraint } from '../../../../src/immutable/constraints/CustomConstraint.js';
import { ConstraintResult } from '../../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../../src/Edge.js';

describe('SchemaConstraintGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new SchemaConstraintGenerator();
  });

  describe('Constructor and Initialization', () => {
    test('should create generator instance', () => {
      expect(generator).toBeInstanceOf(SchemaConstraintGenerator);
      expect(Object.isFrozen(generator)).toBe(true);
    });

    test('should create generator with registry', () => {
      const registry = new EntityTypeRegistry();
      const generatorWithRegistry = new SchemaConstraintGenerator(registry);
      
      expect(generatorWithRegistry.registry).toBe(registry);
    });
  });

  describe('Entity Constraint Generation', () => {
    test('should generate entity type constraint from schema', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age'],
        types: { name: 'string', age: 'number' }
      });

      const constraint = generator.generateEntityConstraint('worksAt', 'source', personType);
      
      expect(constraint).toBeInstanceOf(Constraint);
      expect(constraint.relationshipType).toBe('worksAt');
      
      // Test the generated constraint validates correctly
      const mockStore = {
        getEntityMetadata: (id) => {
          if (id === 'person1') return { type: 'Person' };
          return null;
        }
      };
      
      const validEdge = new Edge('worksAt', 'person1', 'company1');
      const invalidEdge = new Edge('worksAt', 'unknown', 'company1');
      
      const validResult = constraint.validate(mockStore, validEdge, 'addEdge');
      expect(validResult.isValid).toBe(true);
      
      const invalidResult = constraint.validate(mockStore, invalidEdge, 'addEdge');
      expect(invalidResult.isValid).toBe(false);
    });

    test('should generate constraints for both source and target', () => {
      const personType = new EntityType('Person');
      const companyType = new EntityType('Company');

      const constraints = generator.generateRelationshipConstraints('worksAt', {
        source: personType,
        target: companyType
      });

      expect(constraints).toHaveLength(2);
      expect(constraints[0].relationshipType).toBe('worksAt');
      expect(constraints[1].relationshipType).toBe('worksAt');
      
      // One for source, one for target
      const constraintIds = constraints.map(c => c.id);
      expect(constraintIds).toContain('schema-worksAt-source-Person');
      expect(constraintIds).toContain('schema-worksAt-target-Company');
    });

    test('should handle optional source or target', () => {
      const personType = new EntityType('Person');

      // Only source constraint
      const sourceOnly = generator.generateRelationshipConstraints('manages', {
        source: personType
      });
      expect(sourceOnly).toHaveLength(1);
      expect(sourceOnly[0].id).toBe('schema-manages-source-Person');

      // Only target constraint
      const targetOnly = generator.generateRelationshipConstraints('managedBy', {
        target: personType
      });
      expect(targetOnly).toHaveLength(1);
      expect(targetOnly[0].id).toBe('schema-managedBy-target-Person');

      // No constraints
      const noConstraints = generator.generateRelationshipConstraints('generic', {});
      expect(noConstraints).toHaveLength(0);
    });
  });

  describe('Attribute Constraint Generation', () => {
    test('should generate constraint for required attributes', () => {
      const personType = new EntityType('Person', {
        required: ['name', 'age', 'email'],
        types: {
          name: 'string',
          age: 'number',
          email: 'string'
        }
      });

      const constraint = generator.generateAttributeConstraint('Person', personType);
      
      expect(constraint).toBeInstanceOf(CustomConstraint);
      expect(constraint.id).toContain('Person-attributes');
      
      // Test validation
      const mockStore = {
        getEntityMetadata: (id) => {
          if (id === 'person1') {
            return { 
              type: 'Person',
              attributes: { name: 'Alice', age: 30, email: 'alice@test.com' }
            };
          }
          if (id === 'person2') {
            return {
              type: 'Person',
              attributes: { name: 'Bob' } // Missing required fields
            };
          }
          return null;
        }
      };

      const validEdge = new Edge('someRelation', 'person1', 'company1');
      const invalidEdge = new Edge('someRelation', 'person2', 'company1');

      const validResult = constraint.validate(mockStore, validEdge, 'addEdge');
      expect(validResult.isValid).toBe(true);

      const invalidResult = constraint.validate(mockStore, invalidEdge, 'addEdge');
      expect(invalidResult.isValid).toBe(false);
    });

    test('should generate constraint for type validation', () => {
      const projectType = new EntityType('Project', {
        required: ['budget'],
        types: {
          budget: 'number',
          description: 'string'
        }
      });

      const constraint = generator.generateAttributeConstraint('Project', projectType);
      
      const mockStore = {
        getEntityMetadata: (id) => {
          if (id === 'project1') {
            return {
              type: 'Project',
              attributes: { budget: '1000' } // Wrong type
            };
          }
          return null;
        }
      };

      const edge = new Edge('someRelation', 'project1', 'company1');
      const result = constraint.validate(mockStore, edge, 'addEdge');
      
      expect(result.isValid).toBe(false);
      expect(result.violations[0].message).toContain('type');
    });

    test('should generate constraint for value constraints', () => {
      const statusType = new EntityType('Status', {
        required: ['state'],
        types: { state: 'string' },
        constraints: {
          state: {
            enum: ['active', 'inactive', 'pending']
          }
        }
      });

      const constraint = generator.generateAttributeConstraint('Status', statusType);
      
      const mockStore = {
        getEntityMetadata: (id) => {
          if (id === 'status1') {
            return {
              type: 'Status',
              attributes: { state: 'unknown' } // Invalid enum value
            };
          }
          return null;
        }
      };

      const edge = new Edge('someRelation', 'status1', 'entity1');
      const result = constraint.validate(mockStore, edge, 'addEdge');
      
      expect(result.isValid).toBe(false);
    });
  });

  describe('Complete Schema Constraint Generation', () => {
    let registry;

    beforeEach(() => {
      const personType = new EntityType('Person', {
        required: ['name', 'department'],
        types: { name: 'string', department: 'string' }
      });
      
      const projectType = new EntityType('Project', {
        required: ['title', 'budget'],
        types: { title: 'string', budget: 'number' },
        constraints: {
          budget: { min: 0, max: 1000000 }
        }
      });

      registry = new EntityTypeRegistry([personType, projectType]);
    });

    test('should generate all constraints for a schema', () => {
      const generator = new SchemaConstraintGenerator(registry);
      
      const relationshipSchema = {
        'assignedTo': {
          source: 'Person',
          target: 'Project'
        },
        'manages': {
          source: 'Person',
          target: 'Person'
        }
      };

      const constraints = generator.generateAllConstraints(relationshipSchema);
      
      // Should have entity type constraints and attribute constraints
      expect(constraints.length).toBeGreaterThan(0);
      
      // Check for entity type constraints
      const entityConstraints = constraints.filter(c => c.id.includes('schema-'));
      expect(entityConstraints.length).toBeGreaterThan(0);
      
      // Check for attribute constraints
      const attrConstraints = constraints.filter(c => c.id.includes('-attributes'));
      expect(attrConstraints.length).toBeGreaterThan(0);
    });

    test('should generate constraints from registry alone', () => {
      const generator = new SchemaConstraintGenerator(registry);
      const constraints = generator.generateFromRegistry();
      
      // Should generate attribute constraints for each type
      expect(constraints).toHaveLength(2); // Person and Project
      expect(constraints[0].id).toContain('attributes');
      expect(constraints[1].id).toContain('attributes');
    });

    test('should handle inheritance in constraint generation', () => {
      const animalType = new EntityType('Animal', {
        required: ['name'],
        types: { name: 'string' }
      });
      
      const dogType = animalType.extend('Dog', {
        required: ['breed'],
        types: { breed: 'string' }
      });

      const registryWithInheritance = new EntityTypeRegistry([animalType, dogType]);
      const generator = new SchemaConstraintGenerator(registryWithInheritance);
      
      const constraint = generator.generateAttributeConstraint('Dog', dogType);
      
      // Should validate both Animal and Dog requirements
      const mockStore = {
        getEntityMetadata: (id) => {
          if (id === 'dog1') {
            return {
              type: 'Dog',
              attributes: { breed: 'Labrador' } // Missing name from Animal
            };
          }
          return null;
        }
      };

      const edge = new Edge('owns', 'dog1', 'owner1');
      const result = constraint.validate(mockStore, edge, 'addEdge');
      
      expect(result.isValid).toBe(false);
      expect(result.violations[0].message).toContain('name'); // From Animal parent
    });
  });

  describe('Constraint Customization', () => {
    test('should allow custom constraint ID prefix', () => {
      const generator = new SchemaConstraintGenerator(null, { idPrefix: 'custom-' });
      const personType = new EntityType('Person');
      
      const constraint = generator.generateEntityConstraint('worksAt', 'source', personType);
      expect(constraint.id).toMatch(/^custom-/);
    });

    test('should allow custom validation messages', () => {
      const generator = new SchemaConstraintGenerator(null, {
        messages: {
          entityTypeMismatch: 'Wrong entity type: expected {expected}, got {actual}',
          missingAttribute: 'Required attribute {field} is missing'
        }
      });

      const personType = new EntityType('Person', {
        required: ['name']
      });

      const constraint = generator.generateAttributeConstraint('Person', personType);
      
      const mockStore = {
        getEntityMetadata: () => ({
          type: 'Person',
          attributes: {} // Missing name
        })
      };

      const result = constraint.validate(mockStore, new Edge('someRel', 'p1', 'd1'), 'addEdge');
      expect(result.violations[0].message).toContain('Required attribute name is missing');
    });
  });

  describe('Integration with DataStore', () => {
    test('should generate constraints compatible with ImmutableDataStore', () => {
      const personType = new EntityType('Person', {
        required: ['name'],
        types: { name: 'string' }
      });

      const constraint = generator.generateEntityConstraint('worksAt', 'source', personType);
      
      // Verify constraint implements required interface
      expect(constraint).toHaveProperty('id');
      expect(constraint).toHaveProperty('relationshipType');
      expect(constraint).toHaveProperty('validate');
      expect(typeof constraint.validate).toBe('function');
      
      // Verify validate returns ConstraintResult
      const mockStore = {
        getEntityMetadata: () => ({ type: 'Person' })
      };
      const result = constraint.validate(mockStore, new Edge('worksAt', 'p1', 'c1'), 'addEdge');
      
      expect(result).toBeInstanceOf(ConstraintResult);
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('violations');
    });
  });

  describe('Error Handling', () => {
    test('should fail fast on invalid inputs', () => {
      expect(() => generator.generateEntityConstraint(null, 'source', new EntityType('Test')))
        .toThrow('Relationship type is required');
      
      expect(() => generator.generateEntityConstraint('rel', null, new EntityType('Test')))
        .toThrow('Position must be "source" or "target"');
      
      expect(() => generator.generateEntityConstraint('rel', 'invalid', new EntityType('Test')))
        .toThrow('Position must be "source" or "target"');
      
      expect(() => generator.generateEntityConstraint('rel', 'source', null))
        .toThrow('Entity type is required');
      
      expect(() => generator.generateEntityConstraint('rel', 'source', 'not-entity-type'))
        .toThrow('Entity type must be an EntityType instance');
    });

    test('should handle missing registry gracefully', () => {
      const generator = new SchemaConstraintGenerator(); // No registry
      
      const constraints = generator.generateFromRegistry();
      expect(constraints).toEqual([]);
      
      const allConstraints = generator.generateAllConstraints({});
      expect(allConstraints).toEqual([]);
    });
  });
});