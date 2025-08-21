/**
 * Unit tests for RelationshipType and RelationshipTypeRegistry
 * Tests relationship type management per design §1
 */

import { RelationshipType, RelationshipTypeRegistry } from '../../src/RelationshipType.js';
import { ForwardAttribute, BackwardAttribute } from '../../src/Attribute.js';

describe('RelationshipType', () => {
  describe('construction', () => {
    it('should create relationship type with forward and backward names', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      
      expect(type.name).toBe('worksAt');
      expect(type.forwardName).toBe('worksAt');
      expect(type.backwardName).toBe('workedBy');
    });

    it('should validate required parameters', () => {
      expect(() => new RelationshipType()).toThrow('Forward name is required');
      expect(() => new RelationshipType('worksAt')).toThrow('Backward name is required');
    });

    it('should validate names are strings', () => {
      expect(() => new RelationshipType(123, 'workedBy')).toThrow('Forward name must be a string');
      expect(() => new RelationshipType('worksAt', 123)).toThrow('Backward name must be a string');
      expect(() => new RelationshipType('', 'workedBy')).toThrow('Forward name cannot be empty');
      expect(() => new RelationshipType('worksAt', '')).toThrow('Backward name cannot be empty');
    });

    it('should allow identical forward and backward names', () => {
      const type = new RelationshipType('friend', 'friend');
      expect(type.forwardName).toBe('friend');
      expect(type.backwardName).toBe('friend');
    });
  });

  describe('attributes', () => {
    let type;

    beforeEach(() => {
      type = new RelationshipType('worksAt', 'workedBy');
    });

    it('should provide forward attribute', () => {
      const forward = type.getForwardAttribute();
      
      expect(forward).toBeInstanceOf(ForwardAttribute);
      expect(forward.name).toBe('worksAt');
      expect(forward.forwardName).toBe('worksAt');
      expect(forward.backwardName).toBe('workedBy');
    });

    it('should provide backward attribute', () => {
      const backward = type.getBackwardAttribute();
      
      expect(backward).toBeInstanceOf(BackwardAttribute);
      expect(backward.name).toBe('workedBy');
      expect(backward.forwardName).toBe('worksAt');
      expect(backward.backwardName).toBe('workedBy');
    });

    it('should provide both attributes', () => {
      const attributes = type.getAttributes();
      
      expect(attributes).toHaveLength(2);
      expect(attributes[0]).toBeInstanceOf(ForwardAttribute);
      expect(attributes[1]).toBeInstanceOf(BackwardAttribute);
      expect(attributes[0].name).toBe('worksAt');
      expect(attributes[1].name).toBe('workedBy');
    });

    it('should provide attribute by name', () => {
      const forward = type.getAttributeByName('worksAt');
      const backward = type.getAttributeByName('workedBy');
      
      expect(forward).toBeInstanceOf(ForwardAttribute);
      expect(backward).toBeInstanceOf(BackwardAttribute);
      expect(forward.name).toBe('worksAt');
      expect(backward.name).toBe('workedBy');
    });

    it('should return null for unknown attribute name', () => {
      const unknown = type.getAttributeByName('unknown');
      expect(unknown).toBeNull();
    });

    it('should check if attribute name is known', () => {
      expect(type.hasAttribute('worksAt')).toBe(true);
      expect(type.hasAttribute('workedBy')).toBe(true);
      expect(type.hasAttribute('unknown')).toBe(false);
    });
  });

  describe('kernel relations', () => {
    it('should provide kernel relation names', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      const relations = type.getKernelRelationNames();
      
      expect(relations).toHaveLength(2);
      expect(relations).toContain('worksAt');
      expect(relations).toContain('worksAt_inv');
    });

    it('should check if kernel relation belongs to type', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      
      expect(type.hasKernelRelation('worksAt')).toBe(true);
      expect(type.hasKernelRelation('worksAt_inv')).toBe(true);
      expect(type.hasKernelRelation('unknown')).toBe(false);
    });
  });

  describe('equality and identity', () => {
    it('should support equality comparison', () => {
      const type1 = new RelationshipType('worksAt', 'workedBy');
      const type2 = new RelationshipType('worksAt', 'workedBy');
      const type3 = new RelationshipType('livesIn', 'livedIn');
      
      expect(type1.equals(type2)).toBe(true);
      expect(type1.equals(type3)).toBe(false);
      expect(type1.equals(null)).toBe(false);
      expect(type1.equals('not a type')).toBe(false);
    });

    it('should be immutable', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      
      expect(() => { type.name = 'changed'; }).toThrow();
      expect(() => { type.forwardName = 'changed'; }).toThrow();
      expect(() => { type.backwardName = 'changed'; }).toThrow();
    });

    it('should provide string representation', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      const str = type.toString();
      
      expect(str).toContain('RelationshipType');
      expect(str).toContain('worksAt');
      expect(str).toContain('workedBy');
    });
  });

  describe('static factory methods', () => {
    it('should create type with factory method', () => {
      const type = RelationshipType.create('worksAt', 'workedBy');
      
      expect(type).toBeInstanceOf(RelationshipType);
      expect(type.forwardName).toBe('worksAt');
      expect(type.backwardName).toBe('workedBy');
    });

    it('should create symmetric type', () => {
      const type = RelationshipType.symmetric('friend');
      
      expect(type.forwardName).toBe('friend');
      expect(type.backwardName).toBe('friend');
    });
  });
});

describe('RelationshipTypeRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new RelationshipTypeRegistry();
  });

  describe('registration', () => {
    it('should register relationship type', () => {
      const type = new RelationshipType('worksAt', 'workedBy');
      registry.register(type);
      
      expect(registry.hasType('worksAt')).toBe(true);
      expect(registry.getType('worksAt')).toBe(type);
    });

    it('should register with convenience method', () => {
      registry.registerType('worksAt', 'workedBy');
      
      expect(registry.hasType('worksAt')).toBe(true);
      const type = registry.getType('worksAt');
      expect(type.forwardName).toBe('worksAt');
      expect(type.backwardName).toBe('workedBy');
    });

    it('should prevent duplicate type registration', () => {
      const type1 = new RelationshipType('worksAt', 'workedBy');
      const type2 = new RelationshipType('worksAt', 'workedBy');
      
      registry.register(type1);
      expect(() => registry.register(type2)).toThrow('Relationship type \'worksAt\' is already registered');
    });

    it('should validate type parameter', () => {
      expect(() => registry.register(null)).toThrow('Relationship type is required');
      expect(() => registry.register('not a type')).toThrow('Must be a RelationshipType instance');
    });
  });

  describe('retrieval', () => {
    beforeEach(() => {
      registry.registerType('worksAt', 'workedBy');
      registry.registerType('livesIn', 'livedIn');
    });

    it('should get type by name', () => {
      const type = registry.getType('worksAt');
      
      expect(type).toBeInstanceOf(RelationshipType);
      expect(type.forwardName).toBe('worksAt');
      expect(type.backwardName).toBe('workedBy');
    });

    it('should throw for unknown type', () => {
      expect(() => registry.getType('unknown')).toThrow('Relationship type \'unknown\' not found');
    });

    it('should check type existence', () => {
      expect(registry.hasType('worksAt')).toBe(true);
      expect(registry.hasType('livesIn')).toBe(true);
      expect(registry.hasType('unknown')).toBe(false);
    });

    it('should list all type names', () => {
      const names = registry.getTypeNames();
      
      expect(names).toHaveLength(2);
      expect(names).toContain('worksAt');
      expect(names).toContain('livesIn');
    });

    it('should list all types', () => {
      const types = registry.getAllTypes();
      
      expect(types).toHaveLength(2);
      expect(types.every(t => t instanceof RelationshipType)).toBe(true);
    });
  });

  describe('attribute resolution', () => {
    beforeEach(() => {
      registry.registerType('worksAt', 'workedBy');
      registry.registerType('livesIn', 'livedIn');
    });

    it('should resolve attribute by name', () => {
      const attr1 = registry.getAttributeByName('worksAt');
      const attr2 = registry.getAttributeByName('workedBy');
      const attr3 = registry.getAttributeByName('livesIn');
      
      expect(attr1).toBeInstanceOf(ForwardAttribute);
      expect(attr2).toBeInstanceOf(BackwardAttribute);
      expect(attr3).toBeInstanceOf(ForwardAttribute);
      expect(attr1.name).toBe('worksAt');
      expect(attr2.name).toBe('workedBy');
      expect(attr3.name).toBe('livesIn');
    });

    it('should throw for unknown attribute', () => {
      expect(() => registry.getAttributeByName('unknown')).toThrow('Attribute \'unknown\' not found');
    });

    it('should check attribute existence', () => {
      expect(registry.hasAttribute('worksAt')).toBe(true);
      expect(registry.hasAttribute('workedBy')).toBe(true);
      expect(registry.hasAttribute('livesIn')).toBe(true);
      expect(registry.hasAttribute('livedIn')).toBe(true);
      expect(registry.hasAttribute('unknown')).toBe(false);
    });

    it('should list all attribute names', () => {
      const names = registry.getAttributeNames();
      
      expect(names).toHaveLength(4);
      expect(names).toContain('worksAt');
      expect(names).toContain('workedBy');
      expect(names).toContain('livesIn');
      expect(names).toContain('livedIn');
    });
  });

  describe('kernel relation mapping', () => {
    beforeEach(() => {
      registry.registerType('worksAt', 'workedBy');
    });

    it('should map kernel relation to attribute', () => {
      const attr1 = registry.getAttributeByKernelRelation('worksAt');
      const attr2 = registry.getAttributeByKernelRelation('worksAt_inv');
      
      expect(attr1).toBeInstanceOf(ForwardAttribute);
      expect(attr2).toBeInstanceOf(BackwardAttribute);
      expect(attr1.name).toBe('worksAt');
      expect(attr2.name).toBe('workedBy');
    });

    it('should throw for unknown kernel relation', () => {
      expect(() => registry.getAttributeByKernelRelation('unknown')).toThrow('Kernel relation \'unknown\' not found');
    });

    it('should check kernel relation existence', () => {
      expect(registry.hasKernelRelation('worksAt')).toBe(true);
      expect(registry.hasKernelRelation('worksAt_inv')).toBe(true);
      expect(registry.hasKernelRelation('unknown')).toBe(false);
    });

    it('should list all kernel relation names', () => {
      const names = registry.getKernelRelationNames();
      
      expect(names).toHaveLength(2);
      expect(names).toContain('worksAt');
      expect(names).toContain('worksAt_inv');
    });
  });

  describe('registry operations', () => {
    it('should support clearing all types', () => {
      registry.registerType('worksAt', 'workedBy');
      registry.registerType('livesIn', 'livedIn');
      
      expect(registry.getTypeNames()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getTypeNames()).toHaveLength(0);
      expect(registry.hasType('worksAt')).toBe(false);
    });

    it('should support removing individual types', () => {
      registry.registerType('worksAt', 'workedBy');
      registry.registerType('livesIn', 'livedIn');
      
      expect(registry.hasType('worksAt')).toBe(true);
      
      registry.removeType('worksAt');
      
      expect(registry.hasType('worksAt')).toBe(false);
      expect(registry.hasType('livesIn')).toBe(true);
    });

    it('should handle removing non-existent type gracefully', () => {
      expect(() => registry.removeType('unknown')).not.toThrow();
    });

    it('should provide registry statistics', () => {
      registry.registerType('worksAt', 'workedBy');
      registry.registerType('livesIn', 'livedIn');
      
      const stats = registry.getStatistics();
      
      expect(stats.typeCount).toBe(2);
      expect(stats.attributeCount).toBe(4);
      expect(stats.kernelRelationCount).toBe(4);
    });
  });
});