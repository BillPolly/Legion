/**
 * Query Builder Unit Tests
 * Phase 3: Query System
 */

import { Query } from '../../src/core/Query.js';

describe('Query Builder', () => {
  let query;

  beforeEach(() => {
    query = new Query('users');
  });

  describe('Basic Construction', () => {
    test('should create query with collection', () => {
      expect(query.collection).toBe('users');
      expect(query.criteria).toEqual({});
      expect(query.options).toEqual({});
      expect(query.pipeline).toEqual([]);
    });

    test('should create query without collection', () => {
      const q = new Query();
      expect(q.collection).toBeNull();
    });

    test('should set collection with from()', () => {
      const q = new Query();
      q.from('products');
      expect(q.collection).toBe('products');
    });
  });

  describe('Equality and Basic Operators', () => {
    test('where() should add equality criteria', () => {
      query.where('name', 'John');
      expect(query.criteria).toEqual({ name: 'John' });
    });

    test('where() should be chainable', () => {
      const result = query
        .where('name', 'John')
        .where('age', 30);
      
      expect(result).toBe(query);
      expect(query.criteria).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('Comparison Operators', () => {
    test('gt() should add greater than criteria', () => {
      query.gt('age', 18);
      expect(query.criteria).toEqual({ age: { $gt: 18 } });
    });

    test('gte() should add greater than or equal criteria', () => {
      query.gte('age', 18);
      expect(query.criteria).toEqual({ age: { $gte: 18 } });
    });

    test('lt() should add less than criteria', () => {
      query.lt('age', 65);
      expect(query.criteria).toEqual({ age: { $lt: 65 } });
    });

    test('lte() should add less than or equal criteria', () => {
      query.lte('age', 65);
      expect(query.criteria).toEqual({ age: { $lte: 65 } });
    });

    test('should combine multiple comparison operators', () => {
      query.gte('age', 18).lte('age', 65);
      expect(query.criteria).toEqual({ 
        age: { $gte: 18, $lte: 65 } 
      });
    });
  });

  describe('Advanced Operators', () => {
    test('in() should add $in criteria', () => {
      query.in('status', ['active', 'pending']);
      expect(query.criteria).toEqual({ 
        status: { $in: ['active', 'pending'] } 
      });
    });

    test('regex() should add regex criteria', () => {
      query.regex('email', '@gmail.com$', 'i');
      expect(query.criteria).toEqual({ 
        email: { $regex: '@gmail.com$', $options: 'i' } 
      });
    });

    test('regex() without flags should not add $options', () => {
      query.regex('email', '@gmail.com$', '');
      expect(query.criteria).toEqual({ 
        email: { $regex: '@gmail.com$' } 
      });
    });

    test('exists() should add $exists criteria', () => {
      query.exists('deletedAt', false);
      expect(query.criteria).toEqual({ 
        deletedAt: { $exists: false } 
      });
    });

    test('exists() should default to true', () => {
      query.exists('createdAt');
      expect(query.criteria).toEqual({ 
        createdAt: { $exists: true } 
      });
    });
  });

  describe('Options Methods', () => {
    test('sort() with field and direction', () => {
      query.sort('name', 1);
      expect(query.options.sort).toEqual({ name: 1 });
    });

    test('sort() with object', () => {
      query.sort({ name: 1, age: -1 });
      expect(query.options.sort).toEqual({ name: 1, age: -1 });
    });

    test('limit() should set limit', () => {
      query.limit(10);
      expect(query.options.limit).toBe(10);
    });

    test('skip() should set skip', () => {
      query.skip(20);
      expect(query.options.skip).toBe(20);
    });

    test('select() with string should parse fields', () => {
      query.select('name age -password');
      expect(query.options.projection).toEqual({
        name: 1,
        age: 1,
        password: 0
      });
    });

    test('select() with object should set projection directly', () => {
      query.select({ name: 1, email: 1, password: 0 });
      expect(query.options.projection).toEqual({
        name: 1,
        email: 1,
        password: 0
      });
    });
  });

  describe('Aggregation Methods', () => {
    test('aggregate() should add stage to pipeline', () => {
      query.aggregate({ $match: { active: true } });
      expect(query.pipeline).toEqual([
        { $match: { active: true } }
      ]);
    });

    test('match() should add $match stage', () => {
      query.match({ status: 'active' });
      expect(query.pipeline).toEqual([
        { $match: { status: 'active' } }
      ]);
    });

    test('group() should add $group stage', () => {
      query.group({ 
        _id: '$category', 
        count: { $sum: 1 } 
      });
      expect(query.pipeline).toEqual([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
    });

    test('should chain aggregation stages', () => {
      query
        .match({ status: 'active' })
        .group({ _id: '$category', count: { $sum: 1 } })
        .aggregate({ $sort: { count: -1 } });
      
      expect(query.pipeline).toHaveLength(3);
    });
  });

  describe('Build and Clone', () => {
    test('build() should return complete query object', () => {
      query
        .where('active', true)
        .gt('age', 18)
        .sort('name', 1)
        .limit(10);
      
      const built = query.build();
      
      expect(built).toEqual({
        collection: 'users',
        criteria: { active: true, age: { $gt: 18 } },
        options: { sort: { name: 1 }, limit: 10 },
        pipeline: []
      });
    });

    test('clone() should create independent copy', () => {
      query
        .where('active', true)
        .sort('name', 1)
        .limit(10);
      
      const cloned = query.clone();
      
      // Modify original
      query.where('test', 'value');
      query.limit(20);
      
      // Cloned should be unchanged
      expect(cloned.criteria).toEqual({ active: true });
      expect(cloned.options.limit).toBe(10);
    });

    test('clone() should deep copy nested objects', () => {
      query.criteria = { nested: { value: 1 } };
      const cloned = query.clone();
      
      query.criteria.nested.value = 2;
      
      expect(cloned.criteria.nested.value).toBe(1);
    });
  });

  describe('Complex Query Building', () => {
    test('should build complex query with multiple operators', () => {
      query
        .from('products')
        .where('category', 'electronics')
        .gte('price', 100)
        .lte('price', 1000)
        .in('brand', ['Apple', 'Samsung'])
        .exists('inStock', true)
        .regex('name', 'phone', 'i')
        .sort({ price: 1, rating: -1 })
        .limit(20)
        .skip(40)
        .select('name price brand rating -_id');
      
      const built = query.build();
      
      expect(built.collection).toBe('products');
      expect(built.criteria.category).toBe('electronics');
      expect(built.criteria.price).toEqual({ $gte: 100, $lte: 1000 });
      expect(built.criteria.brand).toEqual({ $in: ['Apple', 'Samsung'] });
      expect(built.criteria.inStock).toEqual({ $exists: true });
      expect(built.criteria.name).toEqual({ $regex: 'phone', $options: 'i' });
      expect(built.options.sort).toEqual({ price: 1, rating: -1 });
      expect(built.options.limit).toBe(20);
      expect(built.options.skip).toBe(40);
      expect(built.options.projection).toEqual({
        name: 1,
        price: 1,
        brand: 1,
        rating: 1,
        _id: 0
      });
    });
  });
});