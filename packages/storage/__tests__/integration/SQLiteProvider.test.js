/**
 * SQLiteProvider Integration Tests
 */

import { SQLiteProvider } from '../../src/providers/sqlite/SQLiteProvider.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('SQLiteProvider', () => {
  let provider;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    // Use in-memory database for tests
    provider = new SQLiteProvider({
      filename: ':memory:',
      verbose: false
    });
    await provider.connect();
  });

  afterEach(async () => {
    if (provider && provider.connected) {
      await provider.disconnect();
    }
  });

  afterAll(async () => {
    // Clean up test database file if it exists
    try {
      await fs.unlink(testDbPath);
    } catch (e) {
      // File might not exist
    }
  });

  describe('Connection Management', () => {
    test('should connect to in-memory database', async () => {
      const memProvider = new SQLiteProvider({ filename: ':memory:' });
      await memProvider.connect();
      
      expect(memProvider.connected).toBe(true);
      expect(memProvider.db).toBeDefined();
      
      await memProvider.disconnect();
    });

    test('should connect to file database', async () => {
      const fileProvider = new SQLiteProvider({ filename: testDbPath });
      await fileProvider.connect();
      
      expect(fileProvider.connected).toBe(true);
      
      // Verify file was created
      const stats = await fs.stat(testDbPath);
      expect(stats.isFile()).toBe(true);
      
      await fileProvider.disconnect();
    });

    test('should handle multiple connect/disconnect calls', async () => {
      await provider.connect(); // Already connected
      expect(provider.connected).toBe(true);
      
      await provider.disconnect();
      await provider.disconnect(); // Already disconnected
      expect(provider.connected).toBe(false);
    });
  });

  describe('CRUD Operations', () => {
    describe('Insert', () => {
      test('should insert single document', async () => {
        const doc = { name: 'John', age: 30, active: true };
        const result = await provider.insert('users', doc);
        
        expect(result.acknowledged).toBe(true);
        expect(result.insertedCount).toBe(1);
        expect(result.insertedIds[0]).toBeDefined();
      });

      test('should insert multiple documents', async () => {
        const docs = [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 },
          { name: 'Charlie', age: 28 }
        ];
        
        const result = await provider.insert('users', docs);
        
        expect(result.acknowledged).toBe(true);
        expect(result.insertedCount).toBe(3);
        expect(Object.keys(result.insertedIds)).toHaveLength(3);
      });

      test('should preserve custom _id', async () => {
        const doc = { _id: 'custom-id-123', name: 'Test' };
        await provider.insert('users', doc);
        
        const found = await provider.findOne('users', { _id: 'custom-id-123' });
        expect(found).toBeDefined();
        expect(found._id).toBe('custom-id-123');
        expect(found.name).toBe('Test');
      });
    });

    describe('Find', () => {
      beforeEach(async () => {
        await provider.insert('products', [
          { name: 'Laptop', price: 1200, category: 'electronics', inStock: true },
          { name: 'Mouse', price: 25, category: 'electronics', inStock: true },
          { name: 'Desk', price: 450, category: 'furniture', inStock: false },
          { name: 'Chair', price: 200, category: 'furniture', inStock: true },
          { name: 'Monitor', price: 300, category: 'electronics', inStock: true }
        ]);
      });

      test('should find all documents', async () => {
        const results = await provider.find('products');
        expect(results).toHaveLength(5);
      });

      test('should find with simple query', async () => {
        const results = await provider.find('products', { category: 'furniture' });
        expect(results).toHaveLength(2);
        expect(results.every(r => r.category === 'furniture')).toBe(true);
      });

      test('should support comparison operators', async () => {
        const results = await provider.find('products', { price: { $gte: 300 } });
        expect(results).toHaveLength(3);
        expect(results.every(r => r.price >= 300)).toBe(true);
      });

      test('should support $in operator', async () => {
        const results = await provider.find('products', {
          name: { $in: ['Laptop', 'Mouse', 'Monitor'] }
        });
        expect(results).toHaveLength(3);
      });

      test('should support $regex operator', async () => {
        const results = await provider.find('products', {
          name: { $regex: 'M' }
        });
        expect(results).toHaveLength(2); // Mouse and Monitor
      });

      test('should support $exists operator', async () => {
        await provider.insert('products', { name: 'Special', custom: 'value' });
        
        const withCustom = await provider.find('products', { custom: { $exists: true } });
        expect(withCustom).toHaveLength(1);
        
        const withoutCustom = await provider.find('products', { custom: { $exists: false } });
        expect(withoutCustom).toHaveLength(5);
      });

      test('should support sorting', async () => {
        const results = await provider.find('products', {}, { sort: { price: -1 } });
        
        expect(results[0].name).toBe('Laptop');
        expect(results[1].name).toBe('Desk');
        expect(results[2].name).toBe('Monitor');
      });

      test('should support limit and skip', async () => {
        const results = await provider.find('products', {}, {
          sort: { price: 1 },
          skip: 1,
          limit: 2
        });
        
        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('Chair');
        expect(results[1].name).toBe('Monitor');
      });

      test('should find one document', async () => {
        const result = await provider.findOne('products', { name: 'Laptop' });
        
        expect(result).toBeDefined();
        expect(result.name).toBe('Laptop');
        expect(result.price).toBe(1200);
      });

      test('should return null when findOne finds nothing', async () => {
        const result = await provider.findOne('products', { name: 'NonExistent' });
        expect(result).toBeNull();
      });
    });

    describe('Update', () => {
      beforeEach(async () => {
        await provider.insert('items', [
          { _id: '1', name: 'Item1', value: 10, tags: ['a', 'b'] },
          { _id: '2', name: 'Item2', value: 20, tags: ['b', 'c'] },
          { _id: '3', name: 'Item3', value: 30, tags: ['a', 'c'] }
        ]);
      });

      test('should update single document with $set', async () => {
        const result = await provider.update(
          'items',
          { _id: '1' },
          { $set: { value: 15, updated: true } }
        );
        
        expect(result.acknowledged).toBe(true);
        expect(result.modifiedCount).toBe(1);
        
        const doc = await provider.findOne('items', { _id: '1' });
        expect(doc.value).toBe(15);
        expect(doc.updated).toBe(true);
        expect(doc.name).toBe('Item1'); // Unchanged
      });

      test('should update multiple documents', async () => {
        const result = await provider.update(
          'items',
          { tags: 'a' },
          { $set: { marked: true } },
          { multi: true }
        );
        
        expect(result.modifiedCount).toBe(2);
        
        const marked = await provider.find('items', { marked: true });
        expect(marked).toHaveLength(2);
      });

      test('should update with $inc operator', async () => {
        const result = await provider.update(
          'items',
          { _id: '2' },
          { $inc: { value: 5 } }
        );
        
        expect(result.modifiedCount).toBe(1);
        
        const doc = await provider.findOne('items', { _id: '2' });
        expect(doc.value).toBe(25);
      });

      test('should update with $unset operator', async () => {
        const result = await provider.update(
          'items',
          { _id: '1' },
          { $unset: { tags: 1 } }
        );
        
        expect(result.modifiedCount).toBe(1);
        
        const doc = await provider.findOne('items', { _id: '1' });
        expect(doc.tags).toBeUndefined();
      });

      test('should replace document when no operators used', async () => {
        const result = await provider.update(
          'items',
          { _id: '3' },
          { newField: 'replaced', value: 999 }
        );
        
        expect(result.modifiedCount).toBe(1);
        
        const doc = await provider.findOne('items', { _id: '3' });
        expect(doc.newField).toBe('replaced');
        expect(doc.value).toBe(999);
        expect(doc.name).toBeUndefined(); // Original fields gone
      });
    });

    describe('Delete', () => {
      beforeEach(async () => {
        await provider.insert('temp', [
          { type: 'keep', value: 1 },
          { type: 'delete', value: 2 },
          { type: 'delete', value: 3 },
          { type: 'keep', value: 4 }
        ]);
      });

      test('should delete documents matching query', async () => {
        const result = await provider.delete('temp', { type: 'delete' });
        
        expect(result.acknowledged).toBe(true);
        expect(result.deletedCount).toBe(2);
        
        const remaining = await provider.find('temp');
        expect(remaining).toHaveLength(2);
        expect(remaining.every(d => d.type === 'keep')).toBe(true);
      });

      test('should delete all documents with empty query', async () => {
        const result = await provider.delete('temp', {});
        
        expect(result.deletedCount).toBe(4);
        
        const remaining = await provider.find('temp');
        expect(remaining).toHaveLength(0);
      });

      test('should return 0 when no documents match', async () => {
        const result = await provider.delete('temp', { type: 'nonexistent' });
        
        expect(result.deletedCount).toBe(0);
      });
    });

    describe('Count', () => {
      beforeEach(async () => {
        await provider.insert('counttest', [
          { status: 'active', value: 10 },
          { status: 'active', value: 20 },
          { status: 'inactive', value: 30 },
          { status: 'active', value: 40 }
        ]);
      });

      test('should count all documents', async () => {
        const count = await provider.count('counttest');
        expect(count).toBe(4);
      });

      test('should count with query', async () => {
        const count = await provider.count('counttest', { status: 'active' });
        expect(count).toBe(3);
      });

      test('should count with complex query', async () => {
        const count = await provider.count('counttest', {
          status: 'active',
          value: { $gte: 20 }
        });
        expect(count).toBe(2);
      });
    });
  });

  describe('Collection Management', () => {
    test('should list collections', async () => {
      await provider.insert('col1', { test: 1 });
      await provider.insert('col2', { test: 2 });
      await provider.insert('col3', { test: 3 });
      
      const collections = await provider.listCollections();
      
      expect(collections).toContain('col1');
      expect(collections).toContain('col2');
      expect(collections).toContain('col3');
    });

    test('should drop collection', async () => {
      await provider.insert('to_drop', { data: 'test' });
      
      const dropped = await provider.dropCollection('to_drop');
      expect(dropped).toBe(true);
      
      const collections = await provider.listCollections();
      expect(collections).not.toContain('to_drop');
      
      // Verify data is gone
      const results = await provider.find('to_drop');
      expect(results).toHaveLength(0);
    });

    test('should return false when dropping non-existent collection', async () => {
      const dropped = await provider.dropCollection('does_not_exist');
      expect(dropped).toBe(false);
    });
  });

  describe('SQLite-Specific Features', () => {
    test('should create index', async () => {
      await provider.insert('indexed', [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
        { name: 'C', value: 3 }
      ]);
      
      const indexName = await provider.createIndex('indexed', { name: 1, value: -1 });
      
      expect(indexName).toContain('idx_indexed');
      expect(indexName).toContain('name');
      expect(indexName).toContain('value');
    });

    test('should create unique index', async () => {
      const indexName = await provider.createIndex(
        'unique_test',
        { email: 1 },
        { unique: true, name: 'unique_email' }
      );
      
      expect(indexName).toBe('unique_email');
    });

    test('should execute raw SQL', async () => {
      await provider.insert('raw_test', [
        { name: 'Test1' },
        { name: 'Test2' }
      ]);
      
      const results = await provider.executeSql(
        'SELECT COUNT(*) as count FROM raw_test'
      );
      
      expect(results[0].count).toBe(2);
    });

    test('should vacuum database', async () => {
      await provider.insert('vacuum_test', { data: 'test' });
      await provider.delete('vacuum_test', {});
      
      // Should not throw
      await provider.vacuum();
      
      expect(provider.connected).toBe(true);
    });
  });

  describe('Complex Queries', () => {
    beforeEach(async () => {
      await provider.insert('complex', [
        { name: 'Alice', age: 25, city: 'NYC', active: true, score: 85 },
        { name: 'Bob', age: 30, city: 'LA', active: false, score: 92 },
        { name: 'Charlie', age: 35, city: 'NYC', active: true, score: 78 },
        { name: 'David', age: 28, city: 'Chicago', active: true, score: 88 },
        { name: 'Eve', age: 32, city: 'LA', active: true, score: 95 }
      ]);
    });

    test('should handle complex combined queries', async () => {
      const results = await provider.find('complex', {
        active: true,
        age: { $gte: 28, $lte: 35 },
        city: { $in: ['NYC', 'Chicago'] }
      }, {
        sort: { score: -1 },
        limit: 2
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('David'); // Highest score among matches
      expect(results[1].name).toBe('Charlie');
    });

    test('should handle nested JSON queries', async () => {
      await provider.insert('nested', [
        { name: 'Item1', metadata: { category: 'A', priority: 1 } },
        { name: 'Item2', metadata: { category: 'B', priority: 2 } },
        { name: 'Item3', metadata: { category: 'A', priority: 3 } }
      ]);
      
      const results = await provider.find('nested', {
        'metadata.category': 'A',
        'metadata.priority': { $gte: 2 }
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Item3');
    });
  });

  describe('Error Handling', () => {
    test('should throw error when not connected', async () => {
      const disconnectedProvider = new SQLiteProvider({ filename: ':memory:' });
      
      await expect(disconnectedProvider.find('test')).rejects.toThrow('Not connected');
      await expect(disconnectedProvider.insert('test', {})).rejects.toThrow('Not connected');
      await expect(disconnectedProvider.update('test', {}, {})).rejects.toThrow('Not connected');
      await expect(disconnectedProvider.delete('test', {})).rejects.toThrow('Not connected');
    });

    test('should handle transaction rollback on error', async () => {
      // Insert document with unique _id
      await provider.insert('trans_test', { _id: 'unique1', value: 1 });
      
      // Try to insert multiple documents where one has duplicate _id
      const docs = [
        { _id: 'unique2', value: 2 },
        { _id: 'unique1', value: 3 }, // Duplicate - will cause error
        { _id: 'unique3', value: 4 }
      ];
      
      await expect(provider.insert('trans_test', docs)).rejects.toThrow();
      
      // Verify rollback - only original document should exist
      const results = await provider.find('trans_test');
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe('unique1');
      expect(results[0].value).toBe(1);
    });
  });

  describe('Provider Interface Compliance', () => {
    test('should implement all required provider methods', () => {
      expect(typeof provider.connect).toBe('function');
      expect(typeof provider.disconnect).toBe('function');
      expect(typeof provider.find).toBe('function');
      expect(typeof provider.findOne).toBe('function');
      expect(typeof provider.insert).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.delete).toBe('function');
      expect(typeof provider.count).toBe('function');
      expect(typeof provider.listCollections).toBe('function');
      expect(typeof provider.dropCollection).toBe('function');
    });

    test('should report correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toContain('find');
      expect(capabilities).toContain('insert');
      expect(capabilities).toContain('update');
      expect(capabilities).toContain('delete');
      expect(capabilities).toContain('createIndex');
      expect(capabilities).toContain('transactions');
      expect(capabilities).toContain('json-queries');
      expect(capabilities).toContain('sql-execution');
      expect(capabilities).toContain('vacuum');
    });

    test('should provide correct metadata', () => {
      const metadata = provider.getMetadata();
      
      expect(metadata.name).toBe('SQLiteProvider');
      expect(metadata.connected).toBe(true);
      expect(metadata.filename).toBe(':memory:');
      expect(metadata.inMemory).toBe(true);
    });
  });
});