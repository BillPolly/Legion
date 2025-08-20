import { RelationRegistry } from '../../src/RelationRegistry.js';
import { Schema } from '../../src/Schema.js';

describe('RelationRegistry', () => {
  describe('Schema Management', () => {
    it('should register relation schemas', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([
        { name: 'user', type: 'ID' },
        { name: 'age', type: 'Integer' }
      ]);

      registry.register('Users', schema);
      expect(registry.hasRelation('Users')).toBe(true);
      expect(registry.getSchema('Users')).toBe(schema);
    });

    it('should prevent duplicate relation names', () => {
      const registry = new RelationRegistry();
      const schema1 = new Schema([{ name: 'x', type: 'Integer' }]);
      const schema2 = new Schema([{ name: 'y', type: 'String' }]);

      registry.register('TestRel', schema1);
      expect(() => registry.register('TestRel', schema2)).toThrow('Relation TestRel already exists');
    });

    it('should validate schema is Schema instance', () => {
      const registry = new RelationRegistry();
      expect(() => registry.register('TestRel', {})).toThrow('Schema must be a Schema instance');
      expect(() => registry.register('TestRel', null)).toThrow('Schema must be a Schema instance');
    });

    it('should validate relation name is string', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([]);
      expect(() => registry.register(123, schema)).toThrow('Relation name must be a string');
      expect(() => registry.register(null, schema)).toThrow('Relation name must be a string');
    });
  });

  describe('Schema Retrieval', () => {
    it('should retrieve registered schemas', () => {
      const registry = new RelationRegistry();
      const userSchema = new Schema([
        { name: 'id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);
      const orderSchema = new Schema([
        { name: 'orderId', type: 'ID' },
        { name: 'amount', type: 'Float' }
      ]);

      registry.register('Users', userSchema);
      registry.register('Orders', orderSchema);

      expect(registry.getSchema('Users')).toBe(userSchema);
      expect(registry.getSchema('Orders')).toBe(orderSchema);
    });

    it('should throw error for missing relations', () => {
      const registry = new RelationRegistry();
      expect(() => registry.getSchema('Missing')).toThrow('Relation Missing not found');
    });

    it('should list all relation names', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([]);
      
      registry.register('A', schema);
      registry.register('B', schema);
      registry.register('C', schema);

      const names = registry.getRelationNames();
      expect(names).toEqual(['A', 'B', 'C']);
    });

    it('should check relation existence', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([]);
      
      registry.register('Exists', schema);
      
      expect(registry.hasRelation('Exists')).toBe(true);
      expect(registry.hasRelation('Missing')).toBe(false);
    });
  });

  describe('Registry Operations', () => {
    it('should handle empty registry', () => {
      const registry = new RelationRegistry();
      expect(registry.getRelationNames()).toEqual([]);
      expect(registry.hasRelation('Any')).toBe(false);
    });

    it('should remove relations', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      
      registry.register('TestRel', schema);
      expect(registry.hasRelation('TestRel')).toBe(true);
      
      registry.remove('TestRel');
      expect(registry.hasRelation('TestRel')).toBe(false);
    });

    it('should handle removing non-existent relations', () => {
      const registry = new RelationRegistry();
      expect(() => registry.remove('Missing')).toThrow('Relation Missing not found');
    });

    it('should clear all relations', () => {
      const registry = new RelationRegistry();
      const schema = new Schema([]);
      
      registry.register('A', schema);
      registry.register('B', schema);
      
      expect(registry.getRelationNames().length).toBe(2);
      
      registry.clear();
      expect(registry.getRelationNames().length).toBe(0);
    });
  });
});