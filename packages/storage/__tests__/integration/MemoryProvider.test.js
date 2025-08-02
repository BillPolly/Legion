/**
 * MemoryProvider Integration Tests
 * Phase 6: Memory Provider Testing
 */

import { MemoryProvider } from '../../src/providers/memory/MemoryProvider.js';

describe('MemoryProvider', () => {
  let provider;

  beforeEach(async () => {
    provider = new MemoryProvider();
    await provider.connect();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('Basic CRUD Operations', () => {
    test('should insert and find documents', async () => {
      const doc = { name: 'Test', value: 42 };
      
      await provider.insert('test', doc);
      const results = await provider.find('test');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test');
      expect(results[0].value).toBe(42);
      expect(results[0]._id).toBeDefined();
    });

    test('should update documents', async () => {
      await provider.insert('test', { _id: '1', name: 'Test', value: 10 });
      
      const updateResult = await provider.update(
        'test',
        { _id: '1' },
        { $set: { value: 20 } }
      );
      
      expect(updateResult.modifiedCount).toBe(1);
      
      const doc = await provider.findOne('test', { _id: '1' });
      expect(doc.value).toBe(20);
    });

    test('should delete documents', async () => {
      await provider.insert('test', [
        { name: 'Keep', temp: false },
        { name: 'Delete', temp: true }
      ]);
      
      const deleteResult = await provider.delete('test', { temp: true });
      
      expect(deleteResult.deletedCount).toBe(1);
      
      const remaining = await provider.find('test');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Keep');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await provider.insert('users', [
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
        { name: 'Charlie', age: 35, active: true },
        { name: 'David', age: 28, active: true }
      ]);
    });

    test('should support comparison operators', async () => {
      const results = await provider.find('users', { age: { $gte: 30 } });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should support $in operator', async () => {
      const results = await provider.find('users', { 
        name: { $in: ['Alice', 'David'] } 
      });
      expect(results).toHaveLength(2);
    });

    test('should support sorting', async () => {
      const results = await provider.find('users', {}, { sort: { age: -1 } });
      expect(results[0].name).toBe('Charlie');
      expect(results[1].name).toBe('Alice');
    });

    test('should support limit and skip', async () => {
      const results = await provider.find('users', {}, { 
        sort: { age: 1 },
        skip: 1, 
        limit: 2 
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('David');
      expect(results[1].name).toBe('Alice');
    });
  });

  describe('Collection Management', () => {
    test('should list collections', async () => {
      await provider.insert('col1', { test: true });
      await provider.insert('col2', { test: true });
      
      const collections = await provider.listCollections();
      
      expect(collections).toContain('col1');
      expect(collections).toContain('col2');
    });

    test('should drop collection', async () => {
      await provider.insert('to_drop', { test: true });
      
      const dropped = await provider.dropCollection('to_drop');
      expect(dropped).toBe(true);
      
      const collections = await provider.listCollections();
      expect(collections).not.toContain('to_drop');
    });

    test('should return false when dropping non-existent collection', async () => {
      const dropped = await provider.dropCollection('does_not_exist');
      expect(dropped).toBe(false);
    });
  });

  describe('Data Isolation', () => {
    test('should return copies of documents to prevent external modification', async () => {
      await provider.insert('test', { _id: '1', value: 10 });
      
      const doc1 = await provider.findOne('test', { _id: '1' });
      doc1.value = 999; // Modify returned document
      
      const doc2 = await provider.findOne('test', { _id: '1' });
      expect(doc2.value).toBe(10); // Should be unchanged
    });
  });
});