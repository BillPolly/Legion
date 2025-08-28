/**
 * Tests for Result pattern implementation
 * 
 * Validates Uncle Bob's Clean Code error handling patterns
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Result, ResultBuilder } from '../../src/core/Result.js';

describe('Result Pattern', () => {
  describe('Result creation', () => {
    it('should create successful result', () => {
      const result = Result.success('test value');
      
      expect(result.isSuccess()).toBe(true);
      expect(result.isFailure()).toBe(false);
      expect(result.getValue()).toBe('test value');
    });

    it('should create failed result', () => {
      const error = new Error('test error');
      const result = Result.failure(error);
      
      expect(result.isSuccess()).toBe(false);
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(error);
    });

    it('should throw when accessing value on failure', () => {
      const result = Result.failure(new Error('test'));
      
      expect(() => result.getValue()).toThrow('Cannot get value from failed result');
    });

    it('should throw when accessing error on success', () => {
      const result = Result.success('test');
      
      expect(() => result.getError()).toThrow('Cannot get error from successful result');
    });
  });

  describe('Result.try', () => {
    it('should wrap successful function execution', async () => {
      const fn = async () => 'success value';
      const result = await Result.try(fn);
      
      expect(result.isSuccess()).toBe(true);
      expect(result.getValue()).toBe('success value');
    });

    it('should wrap failed function execution', async () => {
      const error = new Error('execution failed');
      const fn = async () => { throw error; };
      const result = await Result.try(fn);
      
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(error);
    });

    it('should handle synchronous functions', async () => {
      const fn = () => 'sync value';
      const result = await Result.try(fn);
      
      expect(result.isSuccess()).toBe(true);
      expect(result.getValue()).toBe('sync value');
    });
  });

  describe('Result transformations', () => {
    describe('map', () => {
      it('should map successful result', () => {
        const result = Result.success(5);
        const mapped = result.map(x => x * 2);
        
        expect(mapped.isSuccess()).toBe(true);
        expect(mapped.getValue()).toBe(10);
      });

      it('should not map failed result', () => {
        const error = new Error('test');
        const result = Result.failure(error);
        const mapped = result.map(x => x * 2);
        
        expect(mapped.isFailure()).toBe(true);
        expect(mapped.getError()).toBe(error);
      });

      it('should convert mapping exception to failure', () => {
        const result = Result.success(5);
        const mapped = result.map(() => { throw new Error('mapping failed'); });
        
        expect(mapped.isFailure()).toBe(true);
        expect(mapped.getError().message).toBe('mapping failed');
      });
    });

    describe('mapError', () => {
      it('should map error on failure', () => {
        const result = Result.failure(new Error('original'));
        const mapped = result.mapError(err => new Error(`wrapped: ${err.message}`));
        
        expect(mapped.isFailure()).toBe(true);
        expect(mapped.getError().message).toBe('wrapped: original');
      });

      it('should not map error on success', () => {
        const result = Result.success('value');
        const mapped = result.mapError(err => new Error('wrapped'));
        
        expect(mapped.isSuccess()).toBe(true);
        expect(mapped.getValue()).toBe('value');
      });
    });

    describe('mapAsync', () => {
      it('should map with async function', async () => {
        const result = Result.success(5);
        const mapped = await result.mapAsync(async x => x * 2);
        
        expect(mapped.isSuccess()).toBe(true);
        expect(mapped.getValue()).toBe(10);
      });

      it('should handle async mapping errors', async () => {
        const result = Result.success(5);
        const mapped = await result.mapAsync(async () => {
          throw new Error('async failed');
        });
        
        expect(mapped.isFailure()).toBe(true);
        expect(mapped.getError().message).toBe('async failed');
      });
    });
  });

  describe('Result chaining', () => {
    describe('flatMap', () => {
      it('should chain successful results', () => {
        const result = Result.success(5);
        const chained = result.flatMap(x => Result.success(x * 2));
        
        expect(chained.isSuccess()).toBe(true);
        expect(chained.getValue()).toBe(10);
      });

      it('should propagate first failure', () => {
        const error = new Error('first failed');
        const result = Result.failure(error);
        const chained = result.flatMap(x => Result.success(x * 2));
        
        expect(chained.isFailure()).toBe(true);
        expect(chained.getError()).toBe(error);
      });

      it('should propagate second failure', () => {
        const result = Result.success(5);
        const error = new Error('second failed');
        const chained = result.flatMap(() => Result.failure(error));
        
        expect(chained.isFailure()).toBe(true);
        expect(chained.getError()).toBe(error);
      });

      it('should handle exceptions in flatMap function', () => {
        const result = Result.success(5);
        const chained = result.flatMap(() => {
          throw new Error('flatMap exception');
        });
        
        expect(chained.isFailure()).toBe(true);
        expect(chained.getError().message).toBe('flatMap exception');
      });
    });

    describe('flatMapAsync', () => {
      it('should chain async results', async () => {
        const result = Result.success(5);
        const chained = await result.flatMapAsync(async x => Result.success(x * 2));
        
        expect(chained.isSuccess()).toBe(true);
        expect(chained.getValue()).toBe(10);
      });

      it('should handle async exceptions', async () => {
        const result = Result.success(5);
        const chained = await result.flatMapAsync(async () => {
          throw new Error('async exception');
        });
        
        expect(chained.isFailure()).toBe(true);
        expect(chained.getError().message).toBe('async exception');
      });
    });
  });

  describe('Result utilities', () => {
    describe('getValueOr', () => {
      it('should return value on success', () => {
        const result = Result.success('value');
        expect(result.getValueOr('default')).toBe('value');
      });

      it('should return default on failure', () => {
        const result = Result.failure(new Error('failed'));
        expect(result.getValueOr('default')).toBe('default');
      });
    });

    describe('match', () => {
      it('should match success case', () => {
        const result = Result.success(5);
        const matched = result.match({
          onSuccess: x => x * 2,
          onFailure: () => 0
        });
        
        expect(matched).toBe(10);
      });

      it('should match failure case', () => {
        const result = Result.failure(new Error('failed'));
        const matched = result.match({
          onSuccess: x => x * 2,
          onFailure: err => err.message
        });
        
        expect(matched).toBe('failed');
      });

      it('should return value if no success handler', () => {
        const result = Result.success(5);
        const matched = result.match({ onFailure: () => 0 });
        
        expect(matched).toBe(5);
      });

      it('should return error if no failure handler', () => {
        const error = new Error('failed');
        const result = Result.failure(error);
        const matched = result.match({ onSuccess: x => x });
        
        expect(matched).toBe(error);
      });
    });

    describe('toObject', () => {
      it('should serialize successful result', () => {
        const result = Result.success({ data: 'test' });
        const obj = result.toObject();
        
        expect(obj).toEqual({
          success: true,
          value: { data: 'test' },
          error: null
        });
      });

      it('should serialize failed result', () => {
        const error = new Error('test error');
        error.code = 'TEST_CODE';
        const result = Result.failure(error);
        const obj = result.toObject();
        
        expect(obj).toEqual({
          success: false,
          value: null,
          error: {
            message: 'test error',
            code: 'TEST_CODE',
            name: 'Error'
          }
        });
      });
    });
  });

  describe('Result combinators', () => {
    describe('Result.all', () => {
      it('should combine all successful results', () => {
        const results = [
          Result.success(1),
          Result.success(2),
          Result.success(3)
        ];
        
        const combined = Result.all(results);
        expect(combined.isSuccess()).toBe(true);
        expect(combined.getValue()).toEqual([1, 2, 3]);
      });

      it('should fail on first failure', () => {
        const error = new Error('failed');
        const results = [
          Result.success(1),
          Result.failure(error),
          Result.success(3)
        ];
        
        const combined = Result.all(results);
        expect(combined.isFailure()).toBe(true);
        expect(combined.getError()).toBe(error);
      });

      it('should handle empty array', () => {
        const combined = Result.all([]);
        expect(combined.isSuccess()).toBe(true);
        expect(combined.getValue()).toEqual([]);
      });
    });

    describe('Result.allSettled', () => {
      it('should collect all successful values', () => {
        const results = [
          Result.success(1),
          Result.success(2),
          Result.success(3)
        ];
        
        const combined = Result.allSettled(results);
        expect(combined.isSuccess()).toBe(true);
        expect(combined.getValue()).toEqual([1, 2, 3]);
      });

      it('should collect all errors', () => {
        const error1 = new Error('error1');
        const error2 = new Error('error2');
        const results = [
          Result.success(1),
          Result.failure(error1),
          Result.failure(error2)
        ];
        
        const combined = Result.allSettled(results);
        expect(combined.isFailure()).toBe(true);
        expect(combined.getError()).toEqual([error1, error2]);
      });

      it('should handle all failures', () => {
        const error1 = new Error('error1');
        const error2 = new Error('error2');
        const results = [
          Result.failure(error1),
          Result.failure(error2)
        ];
        
        const combined = Result.allSettled(results);
        expect(combined.isFailure()).toBe(true);
        expect(combined.getError()).toEqual([error1, error2]);
      });
    });
  });

  describe('ResultBuilder', () => {
    it('should build successful result when all validations pass', () => {
      const builder = new ResultBuilder();
      const result = builder
        .validate(true, 'first validation failed')
        .validate(1 === 1, 'second validation failed')
        .build('success value');
      
      expect(result.isSuccess()).toBe(true);
      expect(result.getValue()).toBe('success value');
    });

    it('should build failed result on first validation failure', () => {
      const builder = new ResultBuilder();
      const result = builder
        .validate(false, 'first validation failed')
        .validate(true, 'second validation failed')
        .build('success value');
      
      expect(result.isFailure()).toBe(true);
      expect(result.getError().message).toBe('first validation failed');
    });

    it('should accept Error objects for validation errors', () => {
      const error = new Error('custom error');
      const builder = new ResultBuilder();
      const result = builder
        .validate(false, error)
        .build('success value');
      
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(error);
    });

    it('should support chaining multiple validations', () => {
      const builder = new ResultBuilder();
      const value = { name: 'test', age: 25 };
      
      const result = builder
        .validate(value.name !== '', 'Name is required')
        .validate(value.age > 0, 'Age must be positive')
        .validate(value.age < 120, 'Age must be reasonable')
        .build(value);
      
      expect(result.isSuccess()).toBe(true);
      expect(result.getValue()).toBe(value);
    });
  });
});