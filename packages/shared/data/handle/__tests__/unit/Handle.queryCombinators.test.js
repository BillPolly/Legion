/**
 * Unit tests for Handle query combinator methods
 * 
 * Tests the universal Handle query combinator interface that delegates
 * to ResourceManager.queryBuilder(). These tests verify:
 * - Proper delegation to ResourceManager
 * - Input validation and error handling
 * - Method chaining behavior
 * - Terminal method execution
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';

describe('Handle Query Combinator Methods', () => {
  let handle;
  let mockResourceManager;
  let mockQueryBuilder;

  beforeEach(() => {
    // Create mock query builder with chainable methods
    mockQueryBuilder = {
      where: jest.fn(),
      select: jest.fn(),
      join: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      skip: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      first: jest.fn(),
      last: jest.fn(),
      count: jest.fn(),
      toArray: jest.fn()
    };

    // Make all query builder methods chainable
    Object.keys(mockQueryBuilder).forEach(method => {
      if (['first', 'last', 'count', 'toArray'].includes(method)) {
        // Terminal methods return values
        mockQueryBuilder[method].mockReturnValue(
          method === 'count' ? 0 : 
          method === 'toArray' ? [] : 
          null
        );
      } else {
        // Chaining methods return query builder
        mockQueryBuilder[method].mockReturnValue(mockQueryBuilder);
      }
    });

    // Create mock ResourceManager
    mockResourceManager = {
      query: jest.fn().mockReturnValue([]),
      subscribe: jest.fn().mockReturnValue({ 
        unsubscribe: jest.fn(),
        id: 'test-subscription'
      }),
      getSchema: jest.fn().mockReturnValue({}),
      queryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      update: jest.fn(),
      validate: jest.fn().mockReturnValue(true),
      getMetadata: jest.fn().mockReturnValue({})
    };

    // Create Handle instance
    handle = new Handle(mockResourceManager);
  });

  describe('where() method', () => {
    it('should delegate to ResourceManager.queryBuilder with predicate', () => {
      const predicate = user => user.active === true;
      
      const result = handle.where(predicate);

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(predicate);
      expect(result).toBe(mockQueryBuilder);
    });

    it('should throw error if predicate is not a function', () => {
      expect(() => handle.where()).toThrow('Where predicate function is required');
      expect(() => handle.where(null)).toThrow('Where predicate function is required');
      expect(() => handle.where('not a function')).toThrow('Where predicate function is required');
      expect(() => handle.where(123)).toThrow('Where predicate function is required');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.where(() => true)).toThrow('Handle has been destroyed');
    });

    it('should support method chaining', () => {
      const predicate1 = user => user.active === true;
      const predicate2 = user => user.age > 18;

      const result = handle.where(predicate1).where(predicate2);

      expect(mockQueryBuilder.where).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.where).toHaveBeenNthCalledWith(1, predicate1);
      expect(mockQueryBuilder.where).toHaveBeenNthCalledWith(2, predicate2);
    });
  });

  describe('select() method', () => {
    it('should delegate to ResourceManager.queryBuilder with mapper', () => {
      const mapper = user => user.name;
      
      const result = handle.select(mapper);

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(mapper);
      expect(result).toBe(mockQueryBuilder);
    });

    it('should throw error if mapper is not a function', () => {
      expect(() => handle.select()).toThrow('Select mapper function is required');
      expect(() => handle.select(null)).toThrow('Select mapper function is required');
      expect(() => handle.select('not a function')).toThrow('Select mapper function is required');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.select(x => x)).toThrow('Handle has been destroyed');
    });
  });

  describe('join() method', () => {
    it('should delegate to ResourceManager.queryBuilder with otherHandle and condition', () => {
      const otherHandle = new Handle(mockResourceManager);
      const joinCondition = 'userId';
      
      const result = handle.join(otherHandle, joinCondition);

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(otherHandle, joinCondition);
      expect(result).toBe(mockQueryBuilder);
    });

    it('should accept function as join condition', () => {
      const otherHandle = new Handle(mockResourceManager);
      const joinCondition = (a, b) => a.id === b.userId;
      
      const result = handle.join(otherHandle, joinCondition);

      expect(mockQueryBuilder.join).toHaveBeenCalledWith(otherHandle, joinCondition);
    });

    it('should throw error if otherHandle is not a Handle', () => {
      expect(() => handle.join()).toThrow('Join requires another Handle');
      expect(() => handle.join(null)).toThrow('Join requires another Handle');
      expect(() => handle.join({}, 'condition')).toThrow('Join requires another Handle');
    });

    it('should throw error if join condition is missing', () => {
      const otherHandle = new Handle(mockResourceManager);
      expect(() => handle.join(otherHandle)).toThrow('Join condition is required');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      const otherHandle = new Handle(mockResourceManager);
      expect(() => handle.join(otherHandle, 'userId')).toThrow('Handle has been destroyed');
    });
  });

  describe('orderBy() method', () => {
    it('should delegate to ResourceManager.queryBuilder with field and direction', () => {
      const result = handle.orderBy('name', 'desc');

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('name', 'desc');
      expect(result).toBe(mockQueryBuilder);
    });

    it('should default to ascending order if direction not specified', () => {
      const result = handle.orderBy('age');

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('age', 'asc');
    });

    it('should accept function as orderBy field', () => {
      const orderFn = user => user.profile.score;
      const result = handle.orderBy(orderFn);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(orderFn, 'asc');
    });

    it('should throw error if orderBy field is missing', () => {
      expect(() => handle.orderBy()).toThrow('OrderBy field or function is required');
      expect(() => handle.orderBy(null)).toThrow('OrderBy field or function is required');
    });

    it('should throw error if direction is invalid', () => {
      expect(() => handle.orderBy('name', 'invalid')).toThrow('OrderBy direction must be "asc" or "desc"');
      expect(() => handle.orderBy('name', 123)).toThrow('OrderBy direction must be "asc" or "desc"');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.orderBy('name')).toThrow('Handle has been destroyed');
    });
  });

  describe('limit() method', () => {
    it('should delegate to ResourceManager.queryBuilder with count', () => {
      const result = handle.limit(10);

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result).toBe(mockQueryBuilder);
    });

    it('should throw error if count is not a positive number', () => {
      expect(() => handle.limit()).toThrow('Limit count must be a positive number');
      expect(() => handle.limit(null)).toThrow('Limit count must be a positive number');
      expect(() => handle.limit('10')).toThrow('Limit count must be a positive number');
      expect(() => handle.limit(0)).toThrow('Limit count must be a positive number');
      expect(() => handle.limit(-5)).toThrow('Limit count must be a positive number');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.limit(10)).toThrow('Handle has been destroyed');
    });
  });

  describe('skip() method', () => {
    it('should delegate to ResourceManager.queryBuilder with count', () => {
      const result = handle.skip(5);

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(result).toBe(mockQueryBuilder);
    });

    it('should accept 0 as valid skip count', () => {
      const result = handle.skip(0);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('should throw error if count is not a non-negative number', () => {
      expect(() => handle.skip()).toThrow('Skip count must be a non-negative number');
      expect(() => handle.skip(null)).toThrow('Skip count must be a non-negative number');
      expect(() => handle.skip('5')).toThrow('Skip count must be a non-negative number');
      expect(() => handle.skip(-1)).toThrow('Skip count must be a non-negative number');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.skip(5)).toThrow('Handle has been destroyed');
    });
  });

  describe('groupBy() method', () => {
    it('should delegate to ResourceManager.queryBuilder with field', () => {
      const result = handle.groupBy('department');

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('department');
      expect(result).toBe(mockQueryBuilder);
    });

    it('should accept function as groupBy field', () => {
      const groupFn = user => user.address.country;
      const result = handle.groupBy(groupFn);

      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith(groupFn);
    });

    it('should throw error if groupBy field is missing', () => {
      expect(() => handle.groupBy()).toThrow('GroupBy field or function is required');
      expect(() => handle.groupBy(null)).toThrow('GroupBy field or function is required');
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.groupBy('department')).toThrow('Handle has been destroyed');
    });
  });

  describe('aggregate() method', () => {
    it('should delegate to ResourceManager.queryBuilder with function and field', () => {
      const result = handle.aggregate('sum', 'amount');

      expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
      expect(mockQueryBuilder.aggregate).toHaveBeenCalledWith('sum', 'amount');
      expect(result).toBe(mockQueryBuilder);
    });

    it('should accept custom aggregate function', () => {
      const customAgg = (items, field) => items.reduce((a, b) => a + b[field], 0);
      const result = handle.aggregate(customAgg, 'value');

      expect(mockQueryBuilder.aggregate).toHaveBeenCalledWith(customAgg, 'value');
    });

    it('should throw error if aggregate function is missing', () => {
      expect(() => handle.aggregate()).toThrow('Aggregate function is required');
      expect(() => handle.aggregate(null)).toThrow('Aggregate function is required');
    });

    it('should work without field parameter for count aggregation', () => {
      const result = handle.aggregate('count');
      expect(mockQueryBuilder.aggregate).toHaveBeenCalledWith('count', undefined);
    });

    it('should throw error if Handle is destroyed', () => {
      handle.destroy();
      expect(() => handle.aggregate('sum', 'amount')).toThrow('Handle has been destroyed');
    });
  });

  describe('Terminal Methods', () => {
    describe('first() method', () => {
      it('should delegate to ResourceManager.queryBuilder and call first()', () => {
        mockQueryBuilder.first.mockReturnValue({ id: 1, name: 'First' });
        
        const result = handle.first();

        expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
        expect(mockQueryBuilder.first).toHaveBeenCalled();
        expect(result).toEqual({ id: 1, name: 'First' });
      });

      it('should return null if no results', () => {
        mockQueryBuilder.first.mockReturnValue(null);
        
        const result = handle.first();
        expect(result).toBeNull();
      });

      it('should throw error if Handle is destroyed', () => {
        handle.destroy();
        expect(() => handle.first()).toThrow('Handle has been destroyed');
      });
    });

    describe('last() method', () => {
      it('should delegate to ResourceManager.queryBuilder and call last()', () => {
        mockQueryBuilder.last.mockReturnValue({ id: 99, name: 'Last' });
        
        const result = handle.last();

        expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
        expect(mockQueryBuilder.last).toHaveBeenCalled();
        expect(result).toEqual({ id: 99, name: 'Last' });
      });

      it('should return null if no results', () => {
        mockQueryBuilder.last.mockReturnValue(null);
        
        const result = handle.last();
        expect(result).toBeNull();
      });

      it('should throw error if Handle is destroyed', () => {
        handle.destroy();
        expect(() => handle.last()).toThrow('Handle has been destroyed');
      });
    });

    describe('count() method', () => {
      it('should delegate to ResourceManager.queryBuilder and call count()', () => {
        mockQueryBuilder.count.mockReturnValue(42);
        
        const result = handle.count();

        expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
        expect(mockQueryBuilder.count).toHaveBeenCalled();
        expect(result).toBe(42);
      });

      it('should return 0 for empty results', () => {
        mockQueryBuilder.count.mockReturnValue(0);
        
        const result = handle.count();
        expect(result).toBe(0);
      });

      it('should throw error if Handle is destroyed', () => {
        handle.destroy();
        expect(() => handle.count()).toThrow('Handle has been destroyed');
      });
    });

    describe('toArray() method', () => {
      it('should delegate to ResourceManager.queryBuilder and call toArray()', () => {
        const mockData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        mockQueryBuilder.toArray.mockReturnValue(mockData);
        
        const result = handle.toArray();

        expect(mockResourceManager.queryBuilder).toHaveBeenCalledWith(handle);
        expect(mockQueryBuilder.toArray).toHaveBeenCalled();
        expect(result).toEqual(mockData);
      });

      it('should return empty array for no results', () => {
        mockQueryBuilder.toArray.mockReturnValue([]);
        
        const result = handle.toArray();
        expect(result).toEqual([]);
      });

      it('should throw error if Handle is destroyed', () => {
        handle.destroy();
        expect(() => handle.toArray()).toThrow('Handle has been destroyed');
      });
    });
  });

  describe('Complex Query Chains', () => {
    it('should support complex chaining of operations', () => {
      mockQueryBuilder.toArray.mockReturnValue([
        { id: 1, name: 'Alice', age: 30 }
      ]);

      const result = handle
        .where(user => user.active === true)
        .where(user => user.age > 25)
        .select(user => ({ id: user.id, name: user.name }))
        .orderBy('name', 'asc')
        .limit(10)
        .skip(0)
        .toArray();

      expect(mockQueryBuilder.where).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.select).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.limit).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.skip).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.toArray).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 1, name: 'Alice', age: 30 }]);
    });

    it('should maintain correct call order in chains', () => {
      const callOrder = [];
      
      // Track call order
      mockQueryBuilder.where.mockImplementation(() => {
        callOrder.push('where');
        return mockQueryBuilder;
      });
      mockQueryBuilder.orderBy.mockImplementation(() => {
        callOrder.push('orderBy');
        return mockQueryBuilder;
      });
      mockQueryBuilder.limit.mockImplementation(() => {
        callOrder.push('limit');
        return mockQueryBuilder;
      });
      mockQueryBuilder.count.mockImplementation(() => {
        callOrder.push('count');
        return 5;
      });

      const result = handle
        .where(x => x.active)
        .orderBy('name')
        .limit(10)
        .count();

      expect(callOrder).toEqual(['where', 'orderBy', 'limit', 'count']);
      expect(result).toBe(5);
    });
  });

  describe('Error Conditions', () => {
    it('should throw error if ResourceManager does not implement queryBuilder', () => {
      const invalidResourceManager = {
        query: jest.fn(),
        subscribe: jest.fn(),
        getSchema: jest.fn()
        // Missing queryBuilder method
      };

      // The error should be thrown when creating the Handle
      expect(() => new Handle(invalidResourceManager)).toThrow('ResourceManager must implement queryBuilder() method');
    });

    it('should throw error if queryBuilder returns invalid object', () => {
      mockResourceManager.queryBuilder.mockReturnValue(null);
      
      expect(() => handle.where(x => x.active)).toThrow();
    });

    it('should propagate errors from query builder methods', () => {
      mockQueryBuilder.where.mockImplementation(() => {
        throw new Error('Query builder error');
      });

      expect(() => handle.where(x => x.active)).toThrow('Query builder error');
    });
  });
});