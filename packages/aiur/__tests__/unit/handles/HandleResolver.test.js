/**
 * Tests for HandleResolver class
 * 
 * Tests handle resolution functionality for @handleName patterns
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { HandleResolver } from '../../../src/handles/HandleResolver.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

describe('HandleResolver', () => {
  let resolver;
  let registry;

  beforeEach(() => {
    registry = new HandleRegistry();
    resolver = new HandleResolver(registry);
  });

  describe('Pattern Recognition', () => {
    test('should recognize @handleName patterns', () => {
      expect(resolver.isHandleReference('@myHandle')).toBe(true);
      expect(resolver.isHandleReference('@repo123')).toBe(true);
      expect(resolver.isHandleReference('@my-handle')).toBe(true);
      expect(resolver.isHandleReference('@my_handle')).toBe(true);
    });

    test('should not recognize non-handle patterns', () => {
      expect(resolver.isHandleReference('myHandle')).toBe(false);
      expect(resolver.isHandleReference('repo123')).toBe(false);
      expect(resolver.isHandleReference('@')).toBe(false);
      expect(resolver.isHandleReference('')).toBe(false);
      expect(resolver.isHandleReference(null)).toBe(false);
      expect(resolver.isHandleReference(undefined)).toBe(false);
    });

    test('should extract handle name from reference', () => {
      expect(resolver.extractHandleName('@myHandle')).toBe('myHandle');
      expect(resolver.extractHandleName('@repo123')).toBe('repo123');
      expect(resolver.extractHandleName('@my-handle')).toBe('my-handle');
    });

    test('should return null for invalid references', () => {
      expect(resolver.extractHandleName('myHandle')).toBeNull();
      expect(resolver.extractHandleName('@')).toBeNull();
      expect(resolver.extractHandleName('')).toBeNull();
    });
  });

  describe('Simple Resolution', () => {
    beforeEach(() => {
      registry.create('testRepo', { name: 'react', owner: 'facebook' });
      registry.create('testFile', { path: '/src/index.js', content: 'export default {}' });
    });

    test('should resolve simple handle reference', () => {
      const resolved = resolver.resolve('@testRepo');
      expect(resolved).toEqual({ name: 'react', owner: 'facebook' });
    });

    test('should return original value for non-handle references', () => {
      expect(resolver.resolve('normalString')).toBe('normalString');
      expect(resolver.resolve(123)).toBe(123);
      expect(resolver.resolve(true)).toBe(true);
      expect(resolver.resolve(null)).toBe(null);
    });

    test('should throw error for missing handle', () => {
      expect(() => resolver.resolve('@nonExistent')).toThrow('Handle not found: nonExistent');
    });
  });

  describe('Object Resolution', () => {
    beforeEach(() => {
      registry.create('repo', { name: 'react', owner: 'facebook' });
      registry.create('config', { port: 3000, env: 'development' });
    });

    test('should resolve handles in simple objects', () => {
      const input = {
        repository: '@repo',
        settings: '@config',
        static: 'value'
      };

      const resolved = resolver.resolveObject(input);

      expect(resolved).toEqual({
        repository: { name: 'react', owner: 'facebook' },
        settings: { port: 3000, env: 'development' },
        static: 'value'
      });
    });

    test('should resolve handles in nested objects', () => {
      const input = {
        project: {
          repo: '@repo',
          config: '@config'
        },
        meta: {
          created: '2023-01-01',
          settings: {
            repository: '@repo'
          }
        }
      };

      const resolved = resolver.resolveObject(input);

      expect(resolved.project.repo).toEqual({ name: 'react', owner: 'facebook' });
      expect(resolved.project.config).toEqual({ port: 3000, env: 'development' });
      expect(resolved.meta.settings.repository).toEqual({ name: 'react', owner: 'facebook' });
    });

    test('should preserve non-object values', () => {
      const input = {
        string: 'value',
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined
      };

      const resolved = resolver.resolveObject(input);
      expect(resolved).toEqual(input);
    });
  });

  describe('Array Resolution', () => {
    beforeEach(() => {
      registry.create('item1', { id: 1, name: 'first' });
      registry.create('item2', { id: 2, name: 'second' });
    });

    test('should resolve handles in arrays', () => {
      const input = ['@item1', '@item2', 'static'];
      const resolved = resolver.resolveObject(input);

      expect(resolved).toEqual([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
        'static'
      ]);
    });

    test('should resolve handles in arrays within objects', () => {
      const input = {
        items: ['@item1', '@item2'],
        meta: {
          references: ['@item1', 'static']
        }
      };

      const resolved = resolver.resolveObject(input);

      expect(resolved.items[0]).toEqual({ id: 1, name: 'first' });
      expect(resolved.items[1]).toEqual({ id: 2, name: 'second' });
      expect(resolved.meta.references[0]).toEqual({ id: 1, name: 'first' });
      expect(resolved.meta.references[1]).toBe('static');
    });
  });

  describe('Circular Reference Detection', () => {
    test('should detect circular references in objects', () => {
      const circular = { a: 1 };
      circular.self = circular;

      expect(() => resolver.resolveObject(circular)).toThrow('Circular reference detected');
    });

    test('should detect deeper circular references', () => {
      const obj1 = { name: 'obj1' };
      const obj2 = { name: 'obj2', ref: obj1 };
      obj1.ref = obj2;

      expect(() => resolver.resolveObject(obj1)).toThrow('Circular reference detected');
    });

    test('should handle non-circular complex objects', () => {
      registry.create('shared', { value: 'shared' });

      const input = {
        branch1: {
          data: '@shared'
        },
        branch2: {
          data: '@shared'
        }
      };

      const resolved = resolver.resolveObject(input);
      expect(resolved.branch1.data).toEqual({ value: 'shared' });
      expect(resolved.branch2.data).toEqual({ value: 'shared' });
    });
  });

  describe('Error Handling', () => {
    test('should provide clear error messages for missing handles', () => {
      const input = { repo: '@missingHandle' };
      
      expect(() => resolver.resolveObject(input))
        .toThrow('Handle not found: missingHandle');
    });

    test('should handle mixed valid and invalid handles', () => {
      registry.create('valid', { data: 'valid' });

      const input = { 
        valid: '@valid',
        invalid: '@invalid'
      };

      expect(() => resolver.resolveObject(input))
        .toThrow('Handle not found: invalid');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty objects and arrays', () => {
      expect(resolver.resolveObject({})).toEqual({});
      expect(resolver.resolveObject([])).toEqual([]);
    });

    test('should handle null and undefined', () => {
      expect(resolver.resolveObject(null)).toBe(null);
      expect(resolver.resolveObject(undefined)).toBe(undefined);
    });

    test('should handle primitive values', () => {
      expect(resolver.resolveObject('string')).toBe('string');
      expect(resolver.resolveObject(42)).toBe(42);
      expect(resolver.resolveObject(true)).toBe(true);
    });

    test('should handle functions and dates', () => {
      const fn = () => {};
      const date = new Date();

      expect(resolver.resolveObject(fn)).toBe(fn);
      expect(resolver.resolveObject(date)).toBe(date);
    });
  });

  describe('Performance', () => {
    test('should handle large objects efficiently', () => {
      registry.create('item', { data: 'test' });

      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = i % 10 === 0 ? '@item' : `value${i}`;
      }

      const start = Date.now();
      const resolved = resolver.resolveObject(largeObject);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(resolved.key0).toEqual({ data: 'test' });
      expect(resolved.key1).toBe('value1');
    });
  });
});