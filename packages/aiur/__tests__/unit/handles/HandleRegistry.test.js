/**
 * Tests for HandleRegistry class
 * 
 * Tests the core handle storage and retrieval functionality
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

describe('HandleRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new HandleRegistry();
  });

  describe('Handle Creation and Storage', () => {
    test('should create and store a handle', () => {
      const data = { name: 'test-repo', owner: 'facebook' };
      const handleId = registry.create('myRepo', data);

      expect(handleId).toBeTruthy();
      expect(typeof handleId).toBe('string');
    });

    test('should store handle with metadata', () => {
      const data = { name: 'test-repo' };
      const handleId = registry.create('myRepo', data);
      const handle = registry.getHandle(handleId);

      expect(handle).toMatchObject({
        id: handleId,
        name: 'myRepo',
        data: data
      });
      expect(handle.metadata).toMatchObject({
        created: expect.any(Date),
        lastAccessed: expect.any(Date),
        accessCount: expect.any(Number)
      });
    });

    test('should generate unique IDs for different handles', () => {
      const id1 = registry.create('handle1', { data: 1 });
      const id2 = registry.create('handle2', { data: 2 });

      expect(id1).not.toBe(id2);
    });

    test('should allow overwriting existing handle names', () => {
      const data1 = { version: 1 };
      const data2 = { version: 2 };
      
      const id1 = registry.create('myHandle', data1);
      const id2 = registry.create('myHandle', data2);

      expect(id1).not.toBe(id2);
      expect(registry.getByName('myHandle').data).toEqual(data2);
    });
  });

  describe('Handle Retrieval', () => {
    test('should retrieve handle by ID', () => {
      const data = { test: 'data' };
      const handleId = registry.create('testHandle', data);
      const retrieved = registry.getHandle(handleId);

      expect(retrieved.data).toEqual(data);
      expect(retrieved.name).toBe('testHandle');
    });

    test('should retrieve handle by name', () => {
      const data = { test: 'data' };
      registry.create('testHandle', data);
      const retrieved = registry.getByName('testHandle');

      expect(retrieved.data).toEqual(data);
      expect(retrieved.name).toBe('testHandle');
    });

    test('should return null for non-existent handle ID', () => {
      const handle = registry.getHandle('non-existent-id');
      expect(handle).toBeNull();
    });

    test('should return null for non-existent handle name', () => {
      const handle = registry.getByName('non-existent-name');
      expect(handle).toBeNull();
    });

    test('should update access metadata on retrieval', async () => {
      const handleId = registry.create('testHandle', { data: 'test' });
      const initialHandle = registry.getHandle(handleId);
      const initialAccessCount = initialHandle.metadata.accessCount;
      const initialAccessTime = initialHandle.metadata.lastAccessed;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const retrievedHandle = registry.getHandle(handleId);
      expect(retrievedHandle.metadata.accessCount).toBe(initialAccessCount + 1);
      expect(retrievedHandle.metadata.lastAccessed.getTime()).toBeGreaterThan(initialAccessTime.getTime());
    });
  });

  describe('Handle Existence Checking', () => {
    test('should check if handle exists by ID', () => {
      const handleId = registry.create('testHandle', { data: 'test' });
      
      expect(registry.exists(handleId)).toBe(true);
      expect(registry.exists('non-existent-id')).toBe(false);
    });

    test('should check if handle exists by name', () => {
      registry.create('testHandle', { data: 'test' });
      
      expect(registry.existsByName('testHandle')).toBe(true);
      expect(registry.existsByName('non-existent-name')).toBe(false);
    });
  });

  describe('Handle Deletion', () => {
    test('should delete handle by ID', () => {
      const handleId = registry.create('testHandle', { data: 'test' });
      
      expect(registry.exists(handleId)).toBe(true);
      const deleted = registry.delete(handleId);
      
      expect(deleted).toBe(true);
      expect(registry.exists(handleId)).toBe(false);
      expect(registry.existsByName('testHandle')).toBe(false);
    });

    test('should delete handle by name', () => {
      registry.create('testHandle', { data: 'test' });
      
      expect(registry.existsByName('testHandle')).toBe(true);
      const deleted = registry.deleteByName('testHandle');
      
      expect(deleted).toBe(true);
      expect(registry.existsByName('testHandle')).toBe(false);
    });

    test('should return false when deleting non-existent handle', () => {
      expect(registry.delete('non-existent-id')).toBe(false);
      expect(registry.deleteByName('non-existent-name')).toBe(false);
    });
  });

  describe('Handle Listing', () => {
    test('should list all handle names', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });
      registry.create('handle3', { data: 3 });

      const names = registry.listNames();
      expect(names).toContain('handle1');
      expect(names).toContain('handle2');
      expect(names).toContain('handle3');
      expect(names.length).toBe(3);
    });

    test('should list all handles', () => {
      registry.create('handle1', { data: 1 });
      registry.create('handle2', { data: 2 });

      const handles = registry.listHandles();
      expect(handles.length).toBe(2);
      expect(handles[0]).toHaveProperty('name');
      expect(handles[0]).toHaveProperty('data');
      expect(handles[0]).toHaveProperty('metadata');
    });

    test('should return empty arrays when no handles exist', () => {
      expect(registry.listNames()).toEqual([]);
      expect(registry.listHandles()).toEqual([]);
    });
  });

  describe('Thread Safety', () => {
    test('should handle concurrent operations safely', async () => {
      const operations = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          Promise.resolve().then(() => {
            registry.create(`handle${i}`, { data: i });
            return registry.getByName(`handle${i}`);
          })
        );
      }

      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach((result, index) => {
        expect(result).toBeTruthy();
        expect(result.name).toBe(`handle${index}`);
        expect(result.data.data).toBe(index);
      });

      // All handles should exist
      expect(registry.listNames().length).toBe(10);
    });
  });
});